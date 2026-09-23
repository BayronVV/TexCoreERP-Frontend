# Inventory backend example

Este proyecto es un ejemplo mínimo de Django con DRF para manejar movimientos de inventario con kardex y validación de stock.

## Instalación

```bash
cd backend_inventory_example
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

## Endpoint principal

- POST /api/inventory/movements/

### Ejemplo de payload

```json
{
  "item_id": 1,
  "movement_type": "INGRESO",
  "quantity": 50,
  "reference": "OC-00123",
  "notes": "Compra de materia prima"
}
```

```json
{
  "item_id": 1,
  "movement_type": "SALIDA",
  "quantity": 10,
  "reference": "OP-0154",
  "notes": "Salida a producción"
}
```

Si la salida supera el stock actual, la API responde con un error 400.
