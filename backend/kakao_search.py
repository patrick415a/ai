import os
import requests
from dotenv import load_dotenv

load_dotenv()
KAKAO_REST_API_KEY = os.getenv("KAKAO_REST_API_KEY")

def search_kakao_places(query, size=5, x=None, y=None, radius=1000):
    if not KAKAO_REST_API_KEY:
        raise ValueError("카카오 REST API 키가 설정되지 않았습니다.")

    url = "https://dapi.kakao.com/v2/local/search/keyword.json"

    headers = {
        "Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"
    }

    params = {
        "query": query,
        "size": size
    }

    if x is not None and y is not None:
        params.update({
            "x": x,
            "y": y,
            "radius": radius,
        })

    response = requests.get(
        url,
        headers=headers,
        params=params,
        timeout=10
    )

    response.raise_for_status()

    data = response.json()

    places = []

    for item in data.get("documents", []):
        places.append({
            "name": item["place_name"],
            "category": item["category_name"],
            "address": (
                item["road_address_name"]
                or item["address_name"]
            ),
            "lat": float(item["y"]),
            "lng": float(item["x"]),
            "is_registered": True,
            "description": item["category_name"]
        })

    return places