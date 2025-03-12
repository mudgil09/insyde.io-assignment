from django.shortcuts import render
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.http import FileResponse
from .models import Model3D
from .serializers import Model3DSerializer
import os
import logging

# Set up logging
logger = logging.getLogger(__name__)

# Create your views here.

class Model3DViewSet(viewsets.ModelViewSet):
    queryset = Model3D.objects.all()
    serializer_class = Model3DSerializer

    def create(self, request, *args, **kwargs):
        # Get the file from the request
        file_obj = request.FILES.get('file')
        if not file_obj:
            logger.error("No file provided in request")
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

        # Log file details
        logger.info(f"Received file upload: {file_obj.name}, size: {file_obj.size} bytes")

        # Get file format from the file extension
        file_format = file_obj.name.split('.')[-1].lower()
        if file_format not in ['stl', 'obj']:
            logger.error(f"Invalid file format: {file_format}")
            return Response({'error': f'Invalid file format: {file_format}. Only STL and OBJ files are supported.'}, 
                           status=status.HTTP_400_BAD_REQUEST)

        # Check file size (limit to 100MB)
        max_size = 100 * 1024 * 1024  # 100MB in bytes
        if file_obj.size > max_size:
            logger.error(f"File size exceeds limit: {file_obj.size} bytes")
            return Response(
                {'error': f'File size exceeds 100MB limit ({file_obj.size / (1024 * 1024):.2f}MB)'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Create the model instance
            serializer = self.get_serializer(data={
                'name': request.data.get('name', file_obj.name),
                'file': file_obj,
                'file_format': file_format
            })
            
            if not serializer.is_valid():
                logger.error(f"Serializer validation errors: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                
            self.perform_create(serializer)
            
            logger.info(f"Model created successfully: ID {serializer.data.get('id')}")
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        except Exception as e:
            logger.exception(f"Error creating model: {str(e)}")
            return Response({'error': f'Server error: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        try:
            model = self.get_object()
            file_path = model.file.path
            
            # Check if file exists
            if not os.path.exists(file_path):
                logger.error(f"File not found: {file_path}")
                return Response({'error': 'File not found'}, status=status.HTTP_404_NOT_FOUND)
                
            # Log download request
            logger.info(f"Downloading file: {file_path}, size: {os.path.getsize(file_path)} bytes")
            
            return FileResponse(open(file_path, 'rb'), as_attachment=True)
        except Exception as e:
            logger.exception(f"Error downloading file: {str(e)}")
            return Response({'error': f'Server error: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR) 