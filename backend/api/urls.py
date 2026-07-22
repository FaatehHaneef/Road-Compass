from django.urls import path
from .views import TripPlannerView

urlpatterns = [
    path('trip/', TripPlannerView.as_view(), name='trip-planner'),
]
