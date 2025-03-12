from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import Model3DViewSet

router = DefaultRouter()
router.register(r'models', Model3DViewSet)

urlpatterns = [
    path('', include(router.urls)),
] 