// Darkroom fragment shader, verbatim from DR_FS in reference/rullino.html (top-down tray, liquid, safelight → neon).
export const DR_FS = `precision highp float;
uniform sampler2D tPrint;
uniform vec2 uRes, uPaperHalf, uImgHalf, uPrintPos, uRingPos;
uniform float uScale, uT, uDev, uLight, uEntry, uZoom, uZoomK, uSeiche, uSeiche2, uRingT, uBW, uFade, uPrintRot;
varying vec2 vUv;
#define PI 3.14159265
const vec2 TRAY = vec2(0.82, 0.58);
const float PITCH = 1.86, RIM = 0.045;
const vec3 EYE = vec3(0.0, -1.9, 2.7);
const vec3 LAMP = vec3(-0.8, 1.45, 1.3);
float sdR(vec2 p, vec2 b, float r){ vec2 q=abs(p)-b+r; return length(max(q,0.0))+min(max(q.x,q.y),0.0)-r; }
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ return 0.55*vnoise(p)+0.28*vnoise(p*2.03+7.1)+0.17*vnoise(p*4.1+3.7); }
// superficie del liquido: increspature + sessa (l'onda stazionaria della bacinella agitata) + onda d'ingresso
float height(vec2 p, float m){
  float h = 0.0016*sin(dot(p,vec2(21.0,8.0))+uT*1.9) + 0.0013*sin(dot(p,vec2(-9.0,17.0))-uT*1.6)
          + 0.0011*(vnoise(p*9.0+vec2(uT*0.35,-uT*0.25))-0.5);
  if (m > 0.5) {
    h += uSeiche*cos(PI*(p.x+TRAY.x)/(2.0*TRAY.x)) + uSeiche2*cos(PI*(p.y+TRAY.y)/(2.0*TRAY.y));
    float age = uT-uRingT;
    if (age > 0.0) { float r=length(p-uRingPos), fr=age*0.6; h += 0.0055*exp(-age*1.2)*sin((r-fr)*46.0)*exp(-pow((r-fr)*6.0,2.0)); }
  }
  return h;
}
void main(){
  vec2 s = (vUv-0.5)*vec2(uRes.x/uRes.y,1.0);
  float w = 1.0-0.34*s.y*(1.0-0.8*uZoom);
  vec2 p = s*uScale/w; p.y *= mix(1.2,1.0,uZoom); p.y += 0.02;
  p = mix(p, uPrintPos+(p-uPrintPos)*uZoomK, uZoom);
  float idx = clamp(floor(p.x/PITCH+0.5),-1.0,1.0), m = 1.0-abs(idx);
  vec2 lp = p-vec2(idx*PITCH,0.0);
  float dT = sdR(lp,TRAY,0.07);
  vec3 P3 = vec3(p,0.0), V = normalize(EYE-P3);
  vec3 col; float spec=0.0, tube=0.0;
  if (dT < 0.0) {
    float e=0.004;
    float h0=height(lp,m), hx0=height(lp-vec2(e,0),m), hx1=height(lp+vec2(e,0),m), hy0=height(lp-vec2(0,e),m), hy1=height(lp+vec2(0,e),m);
    vec2 g = vec2(hx1-hx0, hy1-hy0)/(2.0*e);
    vec3 N = normalize(vec3(-g,1.0));
    float lap = (hx0+hx1+hy0+hy1-4.0*h0)/(e*e);
    vec2 rp = lp-g*0.06;                                   // rifrazione
    float rib = 0.5+0.5*sin(rp.y*150.0);                    // nervature sul fondo
    vec3 trayC = m>0.5 ? vec3(0.5,0.5,0.49) : (idx<0.0 ? vec3(0.42,0.43,0.42) : vec3(0.55,0.46,0.34));
    col = trayC*(0.9+0.1*rib)*(0.93+0.07*fbm(rp*6.0));
    col *= 0.7+0.3*smoothstep(0.0,-0.09,dT);                // ombra delle pareti
    if (m > 0.5 && uEntry > 0.0) {
      vec2 pp = uPrintPos;
      float cr=cos(uPrintRot), sr=sin(uPrintRot), sc=mix(1.05,1.0,uEntry);
      vec2 q = mat2(cr,-sr,sr,cr)*(rp-pp)/sc;
      float dP = sdR(q,uPaperHalf,0.006);
      float sh = sdR(q-vec2(0.012,-0.018),uPaperHalf,0.012);
      col *= 1.0-0.3*uEntry*(1.0-smoothstep(-0.01,0.05,sh));
      if (dP < 0.002) {
        vec3 paper = vec3(0.965,0.955,0.93)*(0.975+0.025*fbm(q*40.0));
        vec2 iuv = q/(2.0*uImgHalf)+0.5;
        float inImg = (1.0-smoothstep(-0.0015,0.0015,abs(q.x)-uImgHalf.x))*(1.0-smoothstep(-0.0015,0.0015,abs(q.y)-uImgHalf.y));
        vec3 tex = texture2D(tPrint,iuv).rgb;
        float Dt = 1.0-dot(tex,vec3(0.299,0.587,0.114));
        float yN = q.y/uPaperHalf.y*0.5+0.5;
        float tn = uDev-0.18*yN+0.08*(fbm(q*5.0+3.0)-0.5);   // dal bordo che entra per primo, non uniforme
        float pr = clamp((tn-(1.0-Dt)*0.42)/0.5,0.0,1.0); pr = pr*pr*(3.0-2.0*pr);   // prima i neri, ultime le luci
        float refl = 1.0-Dt*pr;
        vec3 img = mix(vec3(refl), tex, uLight*(1.0-uBW)*pr);
        vec3 pc = paper*mix(vec3(1.0), img, inImg);
        col = mix(col, pc, (1.0-smoothstep(-0.002,0.0015,dP))*uEntry);
      }
    }
    col *= vec3(0.95,0.94,0.9);                             // il rivelatore
    col *= 1.0+clamp(lap*0.006,-0.18,0.3);                  // caustiche
    col += 0.16*exp(-pow((dT+0.006)*260.0,2.0));            // menisco sulla parete
    vec3 R = reflect(-V,N);
    float c = dot(R, normalize(LAMP-P3));
    spec = smoothstep(0.99905,0.99965,c) + pow(max(c,0.0),900.0)*0.3 + pow(max(c,0.0),120.0)*0.06;
    float tt = (1.8)/max(R.z,0.05); vec3 hit = P3+R*tt;
    tube = 1.0-smoothstep(0.02,0.09,length(vec2(max(abs(hit.x)-0.75,0.0), hit.y-2.4)));
    float fres = 0.02+0.2*pow(1.0-max(dot(N,V),0.0),5.0);
    col += fres*0.12;
  } else if (dT < RIM) {
    vec2 ee = vec2(0.003,0.0);
    vec2 n2 = normalize(vec2(sdR(lp+ee.xy,TRAY,0.07)-sdR(lp-ee.xy,TRAY,0.07), sdR(lp+ee.yx,TRAY,0.07)-sdR(lp-ee.yx,TRAY,0.07)));
    float top = smoothstep(0.004,0.014,dT)*(1.0-smoothstep(0.032,RIM,dT));
    float inner = 1.0-smoothstep(0.0,0.012,dT), outer = smoothstep(0.03,RIM,dT);
    vec2 l2 = normalize(vec2(-0.5,0.85));
    vec3 trayC = m>0.5 ? vec3(0.5,0.5,0.49) : (idx<0.0 ? vec3(0.42,0.43,0.42) : vec3(0.55,0.46,0.34));
    col = trayC*(0.62+0.42*top+0.3*inner*dot(-n2,l2)+0.3*outer*dot(n2,l2));
  } else {
    col = vec3(0.105,0.1,0.095)*(0.75+0.5*fbm(p*3.0));      // bancone
    float dS = sdR(lp-vec2(0.035,-0.05),TRAY+RIM,0.1);
    col *= 1.0-0.65*(1.0-smoothstep(-0.03,0.14,dS));
    vec2 cell = floor(p*14.0), lc = fract(p*14.0)-0.5;       // gocce
    if (h21(cell) > 0.86) {
      vec2 off = (vec2(h21(cell+3.1),h21(cell+5.3))-0.5)*0.5; float rad = 0.1+0.16*h21(cell+7.7);
      float d = length(lc-off)/rad;
      col *= 1.0-0.25*(1.0-smoothstep(0.8,1.0,d));
      spec += 0.6*(1.0-smoothstep(0.0,0.35,length(lc-off-vec2(-0.3,0.35)*rad)/rad));
    }
  }
  // inattinica → luce
  float lum = dot(col,vec3(0.3,0.59,0.11));
  vec3 safe = vec3(1.0,0.2,0.07)*pow(lum,1.1)*0.74 + vec3(1.0,0.5,0.3)*spec*0.85;
  vec3 lit = col*vec3(1.03,1.0,0.96) + vec3(0.95)*tube*0.55 + spec*0.05;
  vec3 o = mix(safe, lit, uLight);
  o *= mix(1.0, smoothstep(1.3,0.2,length(s*vec2(0.85,1.15))), mix(0.9,0.5,uLight));
  o += (h21(vUv*uRes+fract(uT*13.7)*517.0)-0.5)*mix(0.05,0.018,uLight);
  gl_FragColor = vec4(o*uFade,1.0);
}`;
