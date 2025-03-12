from rest_framework import serializers
from .models import Model3D

class Model3DSerializer(serializers.ModelSerializer):
    class Meta:
        model = Model3D
        fields = ['id', 'name', 'file', 'file_format', 'uploaded_at'] 