import requests
import json

# Tu API Key de Kobo
API_KEY = "c4ca48c3b59ffde8936dc4d5ec21c67010f42527"

# ID del formulario de Kobo (el alfanumérico)
FORM_ID = "ayaSMRju2NSadmpKwoUsCz"

# URL para la API de Kobo (reemplaza con tu FORM_ID)
url = f"https://kf.kobotoolbox.org/api/v2/assets/{FORM_ID}/data?format=geojson"

# Definir encabezados con la autenticación
headers = {"Authorization": f"Token {API_KEY}"}

# Hacer la solicitud GET a la API de Kobo
print("Descargando datos desde Kobo...")
response = requests.get(url, headers=headers)

# Verificar si la solicitud fue exitosa
response.raise_for_status()

# Guardar los datos obtenidos en un archivo GeoJSON
output_path = "data/marejadas.geojson"
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(response.json(), f, ensure_ascii=False, indent=4)

print(f"GeoJSON guardado exitosamente en {output_path}")