"""
MAE fine-tuned ViT-B/16 inference for accessibility classification.

Checkpoint: checkpoint/mae_finetuned_final.pth
Architecture: ViT-B/16 encoder + per-mobility-aid binary heads.
  head output: [accessible_logit, inaccessible_logit]  (index 1 = inaccessible)

Exports:
  score_images(pil_images, disability_type) -> list[float]
      Returns inaccessible probability per image (0-1).
  DISABILITY_TO_HEAD: mapping from disability_type strings to head keys.
"""

import os
import torch
import torch.nn as nn
import torch.nn.functional as F

CHECKPOINT_PATH = os.path.join(os.path.dirname(__file__), "checkpoint", "mae_finetuned_final.pth")

_IMAGENET_MEAN = torch.tensor([0.485, 0.456, 0.406]).view(3, 1, 1)
_IMAGENET_STD  = torch.tensor([0.229, 0.224, 0.225]).view(3, 1, 1)


def _preprocess(pil_img):
    """Resize to 224×224, convert to float tensor, apply ImageNet normalisation.
    Converts via PIL tobytes() → torch.frombuffer — no numpy involved."""
    from PIL import Image
    img = pil_img.resize((224, 224), Image.LANCZOS).convert("RGB")
    raw = img.tobytes()  # H*W*3 bytes, row-major RGB
    t = torch.frombuffer(bytearray(raw), dtype=torch.uint8).reshape(224, 224, 3)
    t = t.permute(2, 0, 1).float() / 255.0  # [3, 224, 224], 0-1
    return (t - _IMAGENET_MEAN) / _IMAGENET_STD

DISABILITY_TO_HEAD = {
    "manual wheelchair":    "manual_wheelchair",
    "electric wheelchair":  "electric_wheelchair",
    "walker":               "walker",
    "walking cane":         "walking_cane",
    "mobility scooter":     "mobility_scooter",
    "no mobility aid":      "mobility_impairment_no_aid",
}

_HEAD_KEYS = list(dict.fromkeys(DISABILITY_TO_HEAD.values()))


# ── Model definition ─────────────────────────────────────────────────────────

class _PatchEmbed(nn.Module):
    def __init__(self):
        super().__init__()
        self.proj = nn.Conv2d(3, 768, kernel_size=16, stride=16)

    def forward(self, x):
        return self.proj(x).flatten(2).transpose(1, 2)


class _Attention(nn.Module):
    def __init__(self):
        super().__init__()
        self.num_heads = 12
        self.head_dim = 64
        self.scale = self.head_dim ** -0.5
        self.qkv = nn.Linear(768, 768 * 3)
        self.proj = nn.Linear(768, 768)

    def forward(self, x):
        B, N, C = x.shape
        qkv = self.qkv(x).reshape(B, N, 3, self.num_heads, self.head_dim).permute(2, 0, 3, 1, 4)
        q, k, v = qkv.unbind(0)
        attn = (q @ k.transpose(-2, -1)) * self.scale
        attn = attn.softmax(dim=-1)
        x = (attn @ v).transpose(1, 2).reshape(B, N, C)
        return self.proj(x)


class _MLP(nn.Module):
    def __init__(self):
        super().__init__()
        self.fc1 = nn.Linear(768, 3072)
        self.fc2 = nn.Linear(3072, 768)

    def forward(self, x):
        return self.fc2(F.gelu(self.fc1(x)))


class _Block(nn.Module):
    def __init__(self):
        super().__init__()
        self.norm1 = nn.LayerNorm(768)
        self.attn = _Attention()
        self.norm2 = nn.LayerNorm(768)
        self.mlp = _MLP()

    def forward(self, x):
        x = x + self.attn(self.norm1(x))
        return x + self.mlp(self.norm2(x))


class _ViTEncoder(nn.Module):
    def __init__(self):
        super().__init__()
        self.patch_embed = _PatchEmbed()
        self.cls_token = nn.Parameter(torch.zeros(1, 1, 768))
        self.pos_embed = nn.Parameter(torch.zeros(1, 197, 768))
        self.blocks = nn.ModuleList([_Block() for _ in range(12)])
        self.norm = nn.LayerNorm(768)

    def forward(self, x):
        x = self.patch_embed(x)
        cls = self.cls_token.expand(x.shape[0], -1, -1)
        x = torch.cat([cls, x], dim=1) + self.pos_embed
        for block in self.blocks:
            x = block(x)
        return self.norm(x)[:, 0]  # CLS token


class _ClassificationHead(nn.Module):
    # Sequential indices: 0=Linear, 1=BatchNorm1d, 2=ReLU, 3=Dropout, 4=Linear
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(768, 256),
            nn.BatchNorm1d(256),
            nn.ReLU(),
            nn.Dropout(p=0.0),
            nn.Linear(256, 2),
        )

    def forward(self, x):
        return self.net(x)


class _MAEFinetunedModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.encoder = _ViTEncoder()
        self.heads = nn.ModuleDict({k: _ClassificationHead() for k in _HEAD_KEYS})

    def forward(self, x, head_key):
        feat = self.encoder(x)
        return self.heads[head_key](feat)


# ── Lazy singleton ────────────────────────────────────────────────────────────

_model_cache = None


def _get_model():
    global _model_cache
    if _model_cache is not None:
        return _model_cache
    print("[vit] Loading ViT checkpoint…")
    model = _MAEFinetunedModel()
    ckpt = torch.load(CHECKPOINT_PATH, map_location="cpu", weights_only=False)
    model.load_state_dict(ckpt["model_state"])
    model.eval()
    _model_cache = model
    print(f"[vit] ViT loaded (epoch {ckpt.get('epoch', '?')}, f1={ckpt.get('f1', '?'):.4f})")
    return model


# ── Public API ────────────────────────────────────────────────────────────────

def score_images(pil_images, disability_type, batch_size=32):
    """
    Score PIL images for accessibility using the fine-tuned MAE.

    Args:
        pil_images:     list of PIL.Image objects (any size; resized internally to 224x224)
        disability_type: string matching a key in DISABILITY_TO_HEAD
        batch_size:     images per forward pass

    Returns:
        list[float]: inaccessible probability for each image (0.0 = accessible, 1.0 = inaccessible)
    """
    if not pil_images:
        return []

    head_key = DISABILITY_TO_HEAD.get(disability_type.lower(), "mobility_impairment_no_aid")
    model = _get_model()

    tensors = torch.stack([_preprocess(img) for img in pil_images])
    all_probs = []
    with torch.no_grad():
        for i in range(0, len(tensors), batch_size):
            batch = tensors[i : i + batch_size]
            logits = model(batch, head_key)
            probs = F.softmax(logits, dim=-1)
            all_probs.extend(probs[:, 1].tolist())  # index 1 = inaccessible

    return all_probs
