# 기기 사진첩 EXIF/GPS PoC

옵션 B(네이티브 앱) 검증용 최소 Expo 앱.
**목적: 내 폰의 가족 여행 사진에서 위치(GPS) 좌표가 실제로 읽히는지 확인.**

## 무엇을 검증하나
- 사진첩 전체 접근(권한) 가능 여부
- 각 사진의 촬영시각(`creationTime`)
- 각 사진의 **위치(`location.latitude/longitude`)** ← 가장 중요
- 카메라 정보(Make/Model)
- 최근 30장 중 GPS가 잡히는 비율(%)

## 실행 방법

```bash
cd poc/device-photo-exif
npm install
npx expo start
```

- **실기기 권장**: 시뮬레이터의 기본 샘플 사진은 GPS 메타가 없어 검증이 안 됨.
  실제 가족 여행 사진이 들어있는 본인 폰에서 Expo Go(또는 dev build)로 실행할 것.
- 앱 실행 → "사진첩 읽기 실행" 버튼 → 권한 허용 → 결과 확인.

## 결과 해석
- **GPS 보유율이 높게 나오면** → 위치 기반 자동 장소 분류가 현실적으로 가능. 옵션 B 진행 OK.
- **GPS가 0%로 나오면**:
  - Android: `ACCESS_MEDIA_LOCATION` 권한이 적용됐는지, dev build로 빌드했는지 확인
    (Expo Go에서 권한이 제대로 안 붙는 경우 `npx expo run:android`로 dev build 권장).
  - iOS: 사진 접근을 "제한적"이 아닌 "전체 허용"으로 했는지 확인.

## 주의
- iOS는 "일부 사진만 허용(Limited)" 선택 시 그 사진들만 조회됨.
- 위치를 끄고 찍은 사진은 좌표가 없음(정상). 시간 기반 그룹핑으로 보완.

자세한 분석은 `../../docs/poc-device-photo-exif.md` 참고.
