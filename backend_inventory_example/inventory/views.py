from decimal import Decimal

from django.db import transaction
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import InventoryItem, InventoryMovement


class InventoryMovementCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        item_id = request.data.get('item_id') or request.data.get('material_id')
        movement_type = request.data.get('movement_type') or request.data.get('type')
        quantity = request.data.get('quantity') or request.data.get('cantidad')
        reference = request.data.get('reference') or request.data.get('purchase_order') or request.data.get('production_order')
        notes = request.data.get('notes') or request.data.get('observations') or request.data.get('observaciones')

        if not item_id or not movement_type or quantity is None:
            return Response({'error': 'Faltan datos requeridos: item_id, movement_type y quantity.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            quantity = Decimal(str(quantity))
        except Exception:
            return Response({'error': 'La cantidad debe ser numérica.'}, status=status.HTTP_400_BAD_REQUEST)

        if quantity <= 0:
            return Response({'error': 'La cantidad debe ser mayor que cero.'}, status=status.HTTP_400_BAD_REQUEST)

        movement_type = str(movement_type).upper()
        if movement_type not in {'INGRESO', 'SALIDA'}:
            return Response({'error': 'Tipo de movimiento inválido. Usa INGRESO o SALIDA.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                item = InventoryItem.objects.select_for_update().get(id=item_id)
                stock_before = Decimal(str(item.stock))

                if movement_type == 'SALIDA' and quantity > stock_before:
                    return Response({
                        'error': 'La salida supera el stock actual.',
                        'stock_actual': str(stock_before),
                    }, status=status.HTTP_400_BAD_REQUEST)

                if movement_type == 'INGRESO':
                    stock_after = stock_before + quantity
                else:
                    stock_after = stock_before - quantity

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
                    created_by=request.user if request.user.is_authenticated else None,
                )

                return Response({
                    'message': 'Movimiento registrado correctamente.',
                    'movement_id': movement.id,
                    'stock_before': str(stock_before),
                    'stock_after': str(stock_after),
                }, status=status.HTTP_201_CREATED)

        except InventoryItem.DoesNotExist:
            return Response({'error': 'Insumo no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
