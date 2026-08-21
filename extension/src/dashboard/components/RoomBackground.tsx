import { useEffect, useRef } from 'react';
import '../room-bg.css';

/** Ambient isometric-room background, fixed behind the whole dashboard (see .room-bg-layer's
 *  z-index: -1 in room-bg.css). Decorative only — aria-hidden, and pointer-events: none so it
 *  never intercepts clicks meant for real UI in front of it. The one live behavior it keeps from
 *  the original demo: a subtle parallax tilt that tracks pointer position across the whole page. */
export default function RoomBackground() {
  const houseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const house = houseRef.current;
    if (!house) return;
    // A whole-page, continuous mouse-tracked tilt is exactly the kind of parallax effect
    // prefers-reduced-motion exists for — skip it entirely rather than trying to tone it down.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const onPointerMove = (e: PointerEvent) => {
      const x = e.pageX / window.innerWidth - 0.5;
      const y = e.pageY / window.innerHeight - 0.5;
      house.style.transform = `perspective(20000px) rotateX(${y * 10 + 70}deg) rotateZ(${x * 30 + 40}deg) translateZ(-10vw)`;
    };

    document.body.addEventListener('pointermove', onPointerMove);
    return () => document.body.removeEventListener('pointermove', onPointerMove);
  }, []);

  return (
    <div className="room-bg-layer" aria-hidden="true">
      <div className="house" id="noryx-room-house" ref={houseRef}>
            <div className="h-lights">
              <div className="h-light" />
              <div className="h-light" />
              <div className="h-light" />
              <div className="h-light" />
              <div className="h-light" />
              <div className="h-light" />
            </div>
            <div className="h-shadow" />
            <div className="alt">
              <div className="alt__front face" />
              <div className="alt__back face" />
              <div className="alt__right face" />
              <div className="alt__left face" />
              <div className="alt__top face"> 
                <div className="light" />
                <div className="light" />
                <div className="light" />
                <div className="light" />
                <div className="light" />
                <div className="light" />
                <div className="light" />
                <div className="light" />
                <div className="light" />
              </div>
              <div className="alt__bottom face" />
            </div>
            <div className="alb">
              <div className="alb__front face" />
              <div className="alb__back face" />
              <div className="alb__right face" />
              <div className="alb__left face" />
              <div className="alb__top face" />
              <div className="alb__bottom face" />
            </div>
            <div className="arb">
              <div className="arb__front face" />
              <div className="arb__back face" />
              <div className="arb__right face" />
              <div className="arb__left face" />
              <div className="arb__top face" />
              <div className="arb__bottom face" />
            </div>
            <div className="blt">
              <div className="blt__front face" />
              <div className="blt__back face" />
              <div className="blt__right face" />
              <div className="blt__left face" />
              <div className="blt__top face" />
              <div className="blt__bottom face" />
            </div>
            <div className="blt2">
              <div className="blt2__front face" />
              <div className="blt2__back face" />
              <div className="blt2__right face" />
              <div className="blt2__left face" />
              <div className="blt2__top face" />
              <div className="blt2__bottom face" />
            </div>
            <div className="blb">
              <div className="blb__front face" />
              <div className="blb__back face" />
              <div className="blb__right face" />
              <div className="blb__left face" />
              <div className="blb__top face" />
              <div className="blb__bottom face" />
            </div>
            <div className="blb2">
              <div className="blb2__front face" />
              <div className="blb2__back face" />
              <div className="blb2__right face" />
              <div className="blb2__left face" />
              <div className="blb2__top face" />
              <div className="blb2__bottom face" />
            </div>
            <div className="puerta-c">
              <div className="puerta">
                <div className="puerta__front face" />
                <div className="puerta__back face" />
                <div className="puerta__right face" />
                <div className="puerta__left face" />
                <div className="puerta__top face" />
                <div className="puerta__bottom face" />
              </div>
              <div className="puerta-l">
                <div className="puerta-l__front face" />
                <div className="puerta-l__back face" />
                <div className="puerta-l__right face" />
                <div className="puerta-l__left face" />
                <div className="puerta-l__top face" />
                <div className="puerta-l__bottom face" />
              </div>
              <div className="puerta-r">
                <div className="puerta-r__front face" />
                <div className="puerta-r__back face" />
                <div className="puerta-r__right face" />
                <div className="puerta-r__left face" />
                <div className="puerta-r__top face" />
                <div className="puerta-r__bottom face" />
              </div>
              <div className="puerta-t">
                <div className="puerta-t__front face" />
                <div className="puerta-t__back face" />
                <div className="puerta-t__right face" />
                <div className="puerta-t__left face" />
                <div className="puerta-t__top face" />
                <div className="puerta-t__bottom face" />
              </div>
            </div>
            <div className="cuadro-l">
              <div className="cuadro-l__front face" />
              <div className="cuadro-l__back face" />
              <div className="cuadro-l__right face" />
              <div className="cuadro-l__left face" />
              <div className="cuadro-l__top face" />
              <div className="cuadro-l__bottom face" />
            </div>
            <div className="cuadro-r">
              <div className="cuadro-r__front face" />
              <div className="cuadro-r__back face" />
              <div className="cuadro-r__right face" />
              <div className="cuadro-r__left face" />
              <div className="cuadro-r__top face" />
              <div className="cuadro-r__bottom face" />
            </div>
            <div className="librero">
              <div className="librero__front face" />
              <div className="librero__back face" />
              <div className="librero__right face" />
              <div className="librero__left face" />
              <div className="librero__top face" />
              <div className="librero__bottom face" />
            </div>
            <div className="libros"> 
              <div className="libro">
                <div className="libro__front face" />
                <div className="libro__back face" />
                <div className="libro__right face" />
                <div className="libro__left face" />
                <div className="libro__top face" />
                <div className="libro__bottom face" />
              </div>
              <div className="libro">
                <div className="libro__front face" />
                <div className="libro__back face" />
                <div className="libro__right face" />
                <div className="libro__left face" />
                <div className="libro__top face" />
                <div className="libro__bottom face" />
              </div>
              <div className="libro">
                <div className="libro__front face" />
                <div className="libro__back face" />
                <div className="libro__right face" />
                <div className="libro__left face" />
                <div className="libro__top face" />
                <div className="libro__bottom face" />
              </div>
              <div className="libro">
                <div className="libro__front face" />
                <div className="libro__back face" />
                <div className="libro__right face" />
                <div className="libro__left face" />
                <div className="libro__top face" />
                <div className="libro__bottom face" />
              </div>
              <div className="libro">
                <div className="libro__front face" />
                <div className="libro__back face" />
                <div className="libro__right face" />
                <div className="libro__left face" />
                <div className="libro__top face" />
                <div className="libro__bottom face" />
              </div>
              <div className="libro">
                <div className="libro__front face" />
                <div className="libro__back face" />
                <div className="libro__right face" />
                <div className="libro__left face" />
                <div className="libro__top face" />
                <div className="libro__bottom face" />
              </div>
            </div>
            <div className="fotos"> 
              <div className="foto">
                <div className="foto__front face" />
                <div className="foto__back face" />
                <div className="foto__right face" />
                <div className="foto__left face" />
                <div className="foto__top face" />
                <div className="foto__bottom face" />
              </div>
              <div className="foto">
                <div className="foto__front face" />
                <div className="foto__back face" />
                <div className="foto__right face" />
                <div className="foto__left face" />
                <div className="foto__top face" />
                <div className="foto__bottom face" />
              </div>
            </div>
            <div className="cajas"> 
              <div className="caja">
                <div className="caja__front face" />
                <div className="caja__back face" />
                <div className="caja__right face" />
                <div className="caja__left face" />
                <div className="caja__top face" />
                <div className="caja__bottom face" />
              </div>
              <div className="caja">
                <div className="caja__front face" />
                <div className="caja__back face" />
                <div className="caja__right face" />
                <div className="caja__left face" />
                <div className="caja__top face" />
                <div className="caja__bottom face" />
              </div>
              <div className="caja">
                <div className="caja__front face" />
                <div className="caja__back face" />
                <div className="caja__right face" />
                <div className="caja__left face" />
                <div className="caja__top face" />
                <div className="caja__bottom face" />
              </div>
            </div>
            <div className="tv">
              <div className="tv__front face" />
              <div className="tv__back face" />
              <div className="tv__right face" />
              <div className="tv__left face" />
              <div className="tv__top face" />
              <div className="tv__bottom face" />
            </div>
            <div className="repisa-t">
              <div className="repisa-t__front face" />
              <div className="repisa-t__back face" />
              <div className="repisa-t__right face" />
              <div className="repisa-t__left face" />
              <div className="repisa-t__top face" />
              <div className="repisa-t__bottom face" />
            </div>
            <div className="repisa-b">
              <div className="repisa-b__front face" />
              <div className="repisa-b__back face" />
              <div className="repisa-b__right face" />
              <div className="repisa-b__left face" />
              <div className="repisa-b__top face" />
              <div className="repisa-b__bottom face" />
            </div>
            <div className="bocina-l">
              <div className="bocina-l__front face" />
              <div className="bocina-l__back face" />
              <div className="bocina-l__right face" />
              <div className="bocina-l__left face" />
              <div className="bocina-l__top face" />
              <div className="bocina-l__bottom face" />
            </div>
            <div className="bocina-r">
              <div className="bocina-r__front face" />
              <div className="bocina-r__back face" />
              <div className="bocina-r__right face" />
              <div className="bocina-r__left face" />
              <div className="bocina-r__top face" />
              <div className="bocina-r__bottom face" />
            </div>
            <div className="muro">
              <div className="muro__front face" />
              <div className="muro__back face" />
              <div className="muro__right face" />
              <div className="muro__left face" />
              <div className="muro__top face" />
              <div className="muro__bottom face" />
            </div>
            <div className="sillon-c">
              <div className="sillon-b">
                <div className="sillon-b__front face" />
                <div className="sillon-b__back face" />
                <div className="sillon-b__right face" />
                <div className="sillon-b__left face" />
                <div className="sillon-b__top face" />
                <div className="sillon-b__bottom face" />
              </div>
              <div className="sillon-t">
                <div className="sillon-t__front face" />
                <div className="sillon-t__back face" />
                <div className="sillon-t__right face" />
                <div className="sillon-t__left face" />
                <div className="sillon-t__top face" />
                <div className="sillon-t__bottom face" />
              </div>
              <div className="sillon-l">
                <div className="sillon-l__front face" />
                <div className="sillon-l__back face" />
                <div className="sillon-l__right face" />
                <div className="sillon-l__left face" />
                <div className="sillon-l__top face" />
                <div className="sillon-l__bottom face" />
              </div>
              <div className="sillon-r">
                <div className="sillon-r__front face" />
                <div className="sillon-r__back face" />
                <div className="sillon-r__right face" />
                <div className="sillon-r__left face" />
                <div className="sillon-r__top face" />
                <div className="sillon-r__bottom face" />
              </div>
            </div>
            <div className="mesa-c">
              <div className="mesa">
                <div className="mesa__front face" />
                <div className="mesa__back face" />
                <div className="mesa__right face" />
                <div className="mesa__left face" />
                <div className="mesa__top face" />
                <div className="mesa__bottom face" />
              </div>
              <div className="mesa-p">
                <div className="mesa-p__front face" />
                <div className="mesa-p__back face" />
                <div className="mesa-p__right face" />
                <div className="mesa-p__left face" />
                <div className="mesa-p__top face" />
                <div className="mesa-p__bottom face" />
              </div>
              <div className="mesa-p">
                <div className="mesa-p__front face" />
                <div className="mesa-p__back face" />
                <div className="mesa-p__right face" />
                <div className="mesa-p__left face" />
                <div className="mesa-p__top face" />
                <div className="mesa-p__bottom face" />
              </div>
              <div className="mesa-p">
                <div className="mesa-p__front face" />
                <div className="mesa-p__back face" />
                <div className="mesa-p__right face" />
                <div className="mesa-p__left face" />
                <div className="mesa-p__top face" />
                <div className="mesa-p__bottom face" />
              </div>
              <div className="mesa-p">
                <div className="mesa-p__front face" />
                <div className="mesa-p__back face" />
                <div className="mesa-p__right face" />
                <div className="mesa-p__left face" />
                <div className="mesa-p__top face" />
                <div className="mesa-p__bottom face" />
              </div>
              <div className="mesa-shadow" />
            </div>
            <div className="tablet">
              <div className="tablet__front face" />
              <div className="tablet__back face" />
              <div className="tablet__right face" />
              <div className="tablet__left face" />
              <div className="tablet__top face" />
              <div className="tablet__bottom face" />
            </div>
          </div>
    </div>
  );
}
