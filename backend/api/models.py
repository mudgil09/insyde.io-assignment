from django.db import models

# Create your models here.

class Model3D(models.Model):
    FILE_FORMATS = [
        ('stl', 'STL'),
        ('obj', 'OBJ'),
    ]
    
    name = models.CharField(max_length=255)
    file = models.FileField(upload_to='models/')
    file_format = models.CharField(max_length=3, choices=FILE_FORMATS)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
