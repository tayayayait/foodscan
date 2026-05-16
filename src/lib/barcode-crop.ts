/**
 * 바코드 스캔 영역 크롭 유틸리티 (ROI — Region of Interest)
 *
 * 가이드 박스 영역만 잘라서 디코더에 전달하면:
 * - 처리할 픽셀 수 대폭 감소 (전체 프레임 대비 ~19배 축소)
 * - 불필요한 배경 노이즈 제거
 * - 디코딩 속도 및 정확도 향상
 */

export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * object-cover로 표시되는 비디오 위의 가이드 박스 좌표를
 * 실제 비디오 해상도 기준 크롭 영역으로 변환합니다.
 *
 * @param videoWidth  - 비디오 실제 해상도 폭 (예: 1920)
 * @param videoHeight - 비디오 실제 해상도 높이 (예: 1080)
 * @param containerWidth  - 컨테이너 CSS 폭 (예: 375)
 * @param containerHeight - 컨테이너 CSS 높이 (예: 320)
 * @param guideWidth  - 가이드 박스 CSS 폭 (예: 280)
 * @param guideHeight - 가이드 박스 CSS 높이 (예: 120)
 * @param marginRatio - 여유 마진 비율 (기본 0.2 = 20%)
 */
export function calculateCropRegion(
  videoWidth: number,
  videoHeight: number,
  containerWidth: number,
  containerHeight: number,
  guideWidth: number,
  guideHeight: number,
  marginRatio = 0.2,
): CropRegion {
  // object-cover 스케일 계산
  const scaleX = videoWidth / containerWidth;
  const scaleY = videoHeight / containerHeight;
  const scale = Math.max(scaleX, scaleY); // object-cover는 큰 쪽 기준

  // 실제로 보이는 비디오 영역 크기 (CSS px 기준)
  const visibleWidth = videoWidth / scale;
  const visibleHeight = videoHeight / scale;

  // 가이드 박스의 컨테이너 내 중앙 위치 (CSS px)
  const guideLeft = (containerWidth - guideWidth) / 2;
  const guideTop = (containerHeight - guideHeight) / 2;

  // 비디오의 보이는 영역 시작점 (CSS px, 컨테이너 기준)
  const videoOffsetX = (containerWidth - visibleWidth) / 2;
  const videoOffsetY = (containerHeight - visibleHeight) / 2;

  // 가이드 박스의 비디오 내 위치 (CSS px 기준)
  const relativeX = guideLeft - videoOffsetX;
  const relativeY = guideTop - videoOffsetY;

  // 비디오 실제 해상도 기준으로 변환
  const cropX = (relativeX / visibleWidth) * videoWidth;
  const cropY = (relativeY / visibleHeight) * videoHeight;
  const cropW = (guideWidth / visibleWidth) * videoWidth;
  const cropH = (guideHeight / visibleHeight) * videoHeight;

  // 마진 추가 (quiet zone 확보)
  const marginW = cropW * marginRatio;
  const marginH = cropH * marginRatio;

  // 비디오 경계 내로 클램핑
  const x = Math.max(0, Math.round(cropX - marginW / 2));
  const y = Math.max(0, Math.round(cropY - marginH / 2));
  const width = Math.min(Math.round(cropW + marginW), videoWidth - x);
  const height = Math.min(Math.round(cropH + marginH), videoHeight - y);

  return { x, y, width, height };
}

/**
 * 비디오에서 지정된 영역만 캔버스에 그립니다.
 * 캔버스는 재사용을 위해 외부에서 전달받습니다.
 */
export function cropVideoFrame(
  video: HTMLVideoElement,
  region: CropRegion,
  canvas: HTMLCanvasElement,
): HTMLCanvasElement {
  canvas.width = region.width;
  canvas.height = region.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(
    video,
    region.x,
    region.y,
    region.width,
    region.height,
    0,
    0,
    region.width,
    region.height,
  );
  return canvas;
}
