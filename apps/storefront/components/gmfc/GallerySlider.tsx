"use client";

import { useCallback } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, EffectCoverflow } from "swiper/modules";
import type { Swiper as SwiperClass } from "swiper";
import "swiper/css";
import "swiper/css/effect-coverflow";
import "swiper/css/pagination";

export interface GalleryImage {
  src: string;
  alt: string;
  caption?: string;
}

export function GallerySlider({ images }: { images: GalleryImage[] }) {
  const handleSwiperInit = useCallback((swiper: SwiperClass) => {
    swiper.on("progress", (s: SwiperClass) => {
      for (let i = 0; i < s.slides.length; i++) {
        const slide = s.slides[i] as HTMLElement & { progress?: number };
        const slideProgress = slide.progress ?? 0;
        const absProgress = Math.abs(slideProgress);
        const opacity = 1 - 0.7 * Math.min(absProgress, 1);
        const blur = 5 * Math.min(absProgress, 1);
        slide.style.opacity = String(opacity);
        slide.style.filter = `blur(${blur}px)`;
      }
    });
    swiper.on("setTransition", (s: SwiperClass, duration: number) => {
      for (let i = 0; i < s.slides.length; i++) {
        const slide = s.slides[i] as HTMLElement;
        slide.style.transitionDuration = `${duration}ms`;
      }
    });
  }, []);

  if (images.length === 0) return null;

  return (
    <div className="gmfci-gallery-wrap" style={{ background: "transparent", padding: "20px 0 0" }}>
      <div className="gmfci-gallery-content">
        <Swiper
          effect="coverflow"
          grabCursor
          centeredSlides
          slidesPerView="auto"
          loop={images.length >= 3}
          watchSlidesProgress
          speed={1200}
          coverflowEffect={{
            rotate: 0,
            stretch: 0,
            depth: 400,
            modifier: 1,
            slideShadows: true,
          }}
          pagination={{ clickable: true }}
          autoplay={{ delay: 5000, disableOnInteraction: false }}
          modules={[Autoplay, Pagination, EffectCoverflow]}
          onSwiper={handleSwiperInit}
          style={{ paddingBottom: "50px" }}
        >
          {images.map((img, index) => (
            <SwiperSlide
              key={`${img.src}-${index}`}
              style={{ width: "460px", height: "520px", maxWidth: "88vw" }}
            >
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: "100%",
                  borderRadius: "16px",
                  overflow: "hidden",
                  boxShadow: "0 15px 40px rgba(0,0,0,0.45)",
                  background: "#1a0b00",
                }}
              >
                <img
                  src={img.src}
                  alt={img.alt}
                  loading={index < 3 ? "eager" : "lazy"}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    padding: "8px",
                  }}
                />
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </div>
  );
}

export default GallerySlider;

