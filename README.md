# UrbanAccess
**Personalized accessibility-aware navigation for Montréal**

Every day, people travel to work, school, appointments, community events, restaurants, and grocery stores. Most navigation apps help us choose a route by optimizing for distance or travel time. For many people with mobility impairments, however, the shortest route is not always the most accessible.
A route that appears simple on a map may include a steep incline, a narrow sidewalk, construction barriers, poor pavement conditions, or other obstacles that make travel difficult or impossible. Information about these barriers is often unavailable before a journey begins, leaving many people uncertain about whether they can safely and comfortably reach their destination.
UrbanAccess was created to help address that gap.
Developed during AI4Good Lab 2026, UrbanAccess is an AI-powered navigation tool designed to recommend routes based not only on where a user wants to go, but also on their individual accessibility needs. By combining community input, route planning, computer vision, and generative AI, we set out to build a more personalized approach to navigating urban environments. Alongside its focus on responsible and inclusive AI, UrbanAccess was built using reproducible, containerized workflows to support collaborative machine learning development.

## Table of Contents

- [Understanding the Problem](#understanding-the-problem)
- [Building an Accessibility Dataset](#building-an-accessibility-dataset)
- [Technical Highlights](#technical-highlights)
- [System Architecture](#system-architecture)
- [Core AI Pipeline](#core-ai-pipeline)
- [Technology Stack](#technology-stack)
- [Development Infrastructure](#development-infrastructure)
- [Lessons Learned](#lessons-learned)
- [Looking Forward](#looking-forward)
- [Acknowledgements](#acknowledgements)

---

### Understanding the Problem

From the beginning, we wanted UrbanAccess to be guided by the experiences of the people it was intended to serve.
We met with accessibility advocates, urban planning researchers, and community leaders working to improve accessibility across Montréal. Their insights helped us better understand the many ways the built environment affects mobility and independence.
To broaden that perspective, we also contacted more than thirty community organizations and distributed a survey to gather feedback from individuals with lived experience navigating mobility challenges. Participants shared the barriers they encounter, the features they consider most important when evaluating a route, and the ways current navigation tools fall short.
One message emerged consistently throughout these conversations: accessibility is highly individual. A route that works well for one person may be unsuitable for another. That insight became the foundation of UrbanAccess.

### Building an Accessibility Dataset

One of the largest challenges facing accessibility-focused navigation is the lack of publicly available data, and this was the case for Montreal. So we built a new dataset.
Our team created a dataset covering more than 14,000 locations across Montréal.
Using OpenTripPlanner, we sampled areas near public transit stations across the city, where people are especially likely to interact with sidewalks and other pedestrian infrastructure. For each location, we retrieved corresponding street-level imagery from Mapillary. We labeled the images using Gemini Vision, generating accessibility scores for six different mobility profiles, and used human survey responses to calibrate and evaluate the quality of these AI-generated labels.
This dataset became the foundation for training the computer vision model and evaluating route accessibility across an entire city.

### Technical Highlights

UrbanAccess combines route planning, computer vision, multimodal AI, and large language models into a multi-stage accessibility recommendation pipeline.
Key project accomplishments include:
Created an accessibility dataset spanning more than 14,000 locations across Montréal using Mapillary imagery, Gemini-generated accessibility labels, and human validation
Fine-tuned a Vision Transformer (MAE) classifier to assess sidewalk accessibility from street level images
Built a multi-stage AI pipeline combining Vision Transformers, Gemini Vision, and Qwen to generate accessibility aware route recommendations
Combined computer vision outputs, environmental accessibility features and user mobility profiles to generate personalized recommendations
Designed a feedback mechanism to support future personalization and continuous system improvement
Built and presented a working prototype during AI4Good Lab Demo Day 2026


### System Architecture

UrbanAcess uses a multi-stage AI pipeline in which specialized models perform complementary tasks. A fine-tuned Vision Transformer (MAE) provides rapid image classification, Gemini Vision performs richer, more detailed accessibility analysis, and Qwen synthesizes the results with user preferences to generate personalized route recommendations.

User Input
origin, destination, travel preferences
    ↓
Route Generation
OpenTripPlanner generates candidate routes
    ↓
Street level Image Retrieval
Street level imagery from Mapillary is retrieved for locations along each candidate route
    ↓
Image Accessibility Classification
A fine-tuned Vision Transformer (Masked Autoencoder) rapidly classifies the accessibility of route images
    ↓
Accessibility Refinement
Gemini Vision refines accessibility assessments by performing richer visual reasoning about sidewalk conditions and accessibility barriers
    ↓
Accessibility Integration
Accessibility predictions are combined with route features and  user-specific mobility requirements
    ↓
Personalized Recommendation
Qwen, an open-source LLM, synthesizes route accessibility data and user preferences to generate: route recommendation, alternative routes, and natural language explanations to describe the pros and cons of each option
     ↓
User Feedback
Optional user feedback supports continuous improvement of recommendations



### Core AI Pipeline

#### 1. Street-Level Image Collection

#### We collected street-level imagery from Mapillary across more than 14,000 Montreal locations, sampled near transit stations and across the island. Each image was stored with latitude, longitude, and view-angle metadata so that accessibility predictions could later be mapped back onto route segments.

#### 2. AI-Assisted Accessibility Labelling

#### Because manually labelling tens of thousands of images across multiple mobility aid types was not feasible, we used Gemini 2.5 Flash to generate accessibility scores. Each image was rated on a 0–4 scale for six mobility aid categories:


### Manual wheelchair


### Electric wheelchair


### Walker


### Walking cane


### Mobility scooter


### Mobility impairment without aid


### This produced 42,342 labelled rows, with 31,887 usable sidewalk-quality examples.

#### 3. Human Calibration and Binarization

#### To reduce bias from raw AI-generated labels, we calibrated Gemini scores against human survey ratings collected from Montreal community members and disability advocates. Survey statistics were used to z-score normalize the AI labels, then convert them into binary accessible/inaccessible labels.


#### z = (gemini_score − μ_gemini) / σ_gemini


#### recalibrated_score = z × σ_survey + μ_survey


#### binary_label = 1 if recalibrated_score ≥ 2.5 else 0


#### This made the final labels reflect human accessibility judgements rather than unadjusted model outputs.

#### 4. MAE Pre-Training

#### Before supervised training, we pre-trained a Vision Transformer using Masked Autoencoder methodology on approximately 69,000 unlabelled street-level images from Montreal, Chicago, and Seattle. This helped the model learn domain-specific visual structure such as sidewalks, curbs, ramps, road edges, and urban surfaces before being fine-tuned for accessibility classification.


#### The MAE model completed 95 epochs and reached a final reconstruction loss of approximately 0.38.

#### 5. Vision Transformer Fine-Tuning

#### The MAE-pretrained Vision Transformer was fine-tuned on the labelled Montreal accessibility dataset. The model uses six parallel binary classification heads, one for each supported mobility aid type, allowing a single image to be scored differently depending on the user’s mobility needs.


#### The deployed model was selected from six fine-tuning passes. The best deployed pass achieved:


#### Validation accuracy: 76.1%


#### Mean F1 score: 72.6%

#### 6. VLM Secondary Scoring

#### At inference time, the Vision Transformer provides fast accessibility scoring for route imagery. The system then sends the most uncertain or inaccessible route points to Gemini 2.5 Flash for richer contextual analysis. This produces natural-language justifications for barriers such as steep slopes, missing curb cuts, construction, uneven pavement, or obstructed sidewalks.

#### 7. Route Recommendation Synthesis

#### For each user query, Urban Access generates multiple candidate routes, retrieves street-level images along each path, scores route segments with the ViT, enriches critical points with VLM reasoning, and combines the results with auxiliary data including:


#### Pedestrian safety data


#### Construction data


#### Gradient and elevation data


#### User feedback from similar journeys


#### An open-source LLM then synthesizes these signals into a ranked route recommendation with plain-language explanations and warnings.



### Technology Stack

#### Backend
Python
FastAPI
Uvicorn
SQLAlchemy
SQLite
Pydantic
python-dotenv
python-jose
#### AI / Machine Learning
PyTorch
Custom ViT-B/16 with MAE pre-training
Google Gemini 2.5 Flash
HuggingFace models
Sentence Transformers
FAISS
scikit-learn
NumPy
Pandas
Pillow
#### Routing and Geospatial Data
OpenStreetMap
OSRM / OpenStreetMap-based routing
OpenTripPlanner 2.5
GTFS / STM transit data
Polyline route geometry
Mapillary street-level imagery
#### Frontend and Mapping
HTML
CSS
JavaScript
Leaflet
Leaflet Heat
CARTO / OpenStreetMap basemaps
#### Data Storage and User Feedback
Supabase
Row-level access controls
Secure user account storage
Proximity-weighted feedback integration
Account deletion and user data control


### Development Infrastructure

UrbanAccess was developed using a containerized workflow to support collaborative machine learning development. Docker was used to standardize datasets, model dependencies, and runtime environments, allowing the complete ML pipeline to run consistently across development machines, improving reproducibility and simplifying collaboration.


### Lessons Learned

Developing UrbanAccess reinforced the idea that accessibility cannot be reduced to a single score or definition. Our stakeholder interviews and user surveys repeatedly gave rise to this idea: routes accessible to one person could have substantial barriers for another. That idea shaped our recommendation pipeline and approach to personalization.
More broadly, UrbanAccess reinforces the idea that meaningful AI systems require more than strong models. They require an understanding of the people, environments, and real-world problems those models are intended to support.

### Looking Forward

UrbanAccess is an early prototype, but we believe it demonstrates the potential for more inclusive navigation systems.
Future work could include integrating real-time construction and transit information, incorporating weather-related accessibility impacts, expanding support for additional accessibility needs, extending coverage beyond Montréal, and improving personalization through continued user feedback.
We hope UrbanAccess represents one step toward making cities easier to navigate for everyone.

### Acknowledgements

UrbanAccess was developed during AI4Good Lab 2026 with support from mentors, researchers, accessibility advocates, and community partners.
We are especially grateful to the community members, organizations, and subject matter experts who shared their experiences and expertise throughout the project. Their contributions helped shape UrbanAccess at every stage of development.

