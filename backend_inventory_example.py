from decimal import Decimal

# ============================================================
# MODELO DE EJEMPLO - BACKEND (Django / DRF)
# ============================================================
# Este archivo sirve como referencia para implementar en tu backend
# real. No afecta al frontend actual.

# models.py
MODEL_EXAMPLE = '''
from django.db import models
from django.conf import settings


class InventoryItem(models.Model):
    name = models.CharField(max_length=255)
    stock = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    unit = models.CharField(max_length=50, default='kg')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class InventoryMovement(models.Model):
    MOVEMENT_TYPES = (
        ('INGRESO', 'Ingreso'),
        ('SALIDA', 'Salida'),
    )

    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name='movements')
    movement_type = models.CharField(max_length=20, choices=MOVEMENT_TYPES)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    stock_before = models.DecimalField(max_digits=12, decimal_places=2)
    stock_after = models.DecimalField(max_digits=12, decimal_places=2)
    reference = models.CharField(max_length=255, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.item.name} - {self.movement_type} - {self.quantity}'
'''

# serializers.py
SERIALIZER_EXAMPLE = '''
from rest_framework import serializers
from .models import InventoryItem, InventoryMovement


class InventoryItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryItem
        fields = ['id', 'name', 'stock', 'unit', 'created_at']


class InventoryMovementSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryMovement
        fields = [
            'id',
            'item',
            'movement_type',
            'quantity',
            'stock_before',
            'stock_after',
            'reference',
            'notes',
            'created_by',
            'created_at',
        ]
        read_only_fields = ['id', 'stock_before', 'stock_after', 'created_by', 'created_at']
'''

# views.py
VIEW_EXAMPLE = '''
from django.db import transaction
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import InventoryItem, InventoryMovement


class InventoryMovementCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        item_id = request.data.get('item_id')
        movement_type = request.data.get('movement_type')
        quantity = request.data.get('quantity')
        reference = request.data.get('reference')
        notes = request.data.get('notes')

        if not item_id or not movement_type or quantity is None:
            return Response({'error': 'Faltan datos requeridos.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            quantity = float(quantity)
        except (TypeError, ValueError):
            return Response({'error': 'Cantidad inválida.'}, status=status.HTTP_400_BAD_REQUEST)

        if quantity <= 0:
            return Response({'error': 'La cantidad debe ser mayor que cero.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                item = InventoryItem.objects.select_for_update().get(id=item_id)
                stock_before = item.stock

                if movement_type == 'SALIDA' and quantity > stock_before:
                    return Response({
                        'error': 'La salida supera el stock actual.',
                        'stock_actual': stock_before,
                    }, status=status.HTTP_400_BAD_REQUEST)

                if movement_type == 'INGRESO':
                    stock_after = stock_before + quantity
                elif movement_type == 'SALIDA':
                    stock_after = stock_before - quantity
                else:
                    return Response({'error': 'Tipo de movimiento inválido.'}, status=status.HTTP_400_BAD_REQUEST)

                item.stock = stock_after
                item.save(update_fields=['stock'])

                movement = InventoryMovement.objects.create(
                    item=item,
                    movement_type=movement_type,
                    quantity=quantity,
                    stock_before=stock_before,
                    stock_after=stock_after,
                    reference=reference,
                    notes=notes,
                    created_by=request.user,
                )

                return Response({
                    'message': 'Movimiento registrado correctamente.',
                    'movement_id': movement.id,
                    'stock_after': stock_after,
                }, status=status.HTTP_201_CREATED)
        except InventoryItem.DoesNotExist:
            return Response({'error': 'Insumo no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
'''

# urls.py
URLS_EXAMPLE = '''
from django.urls import path
from .views import InventoryMovementCreateView

urlpatterns = [
    path('api/inventory/movements/', InventoryMovementCreateView.as_view(), name='inventory-movements-create'),
]
'''

print('--- models.py ---')
print(MODEL_EXAMPLE)
print('\n--- serializers.py ---')
print(SERIALIZER_EXAMPLE)
print('\n--- views.py ---')
print(VIEW_EXAMPLE)
print('\n--- urls.py ---')
print(URLS_EXAMPLE)
