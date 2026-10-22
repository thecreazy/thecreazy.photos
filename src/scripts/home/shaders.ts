// Shaders and light-gate meshes, verbatim from the prototype (FILM_VS / FILM_FS / gate / halo).
import { AdditiveBlending, Mesh, PlaneGeometry, ShaderMaterial, type Scene } from 'three';
import { FH, FW, GATE, STRIP_H } from './constants';

export const FILM_VS = `uniform float uSegX, uScroll, uCurve, uTime, uHoverX, uSpeed;
varying vec2 vUv; varying vec2 vG;
void main(){
  vUv=uv; vec3 p=position; float gx=p.x+uSegX-uScroll;
  float lift=5.0*exp(-pow((gx-uHoverX)/24.0,2.0));
  float fl=sin(gx*0.03-uTime*1.2)*(0.5+min(uSpeed,600.0)*0.004)+sin(gx*0.009+uTime*0.6)*0.9;
  vG=vec2(gx,p.y);
  p.x=gx; p.z=-uCurve*gx*gx+lift+fl; p.y+=sin(gx*0.018+uTime*0.8)*0.5;
  gl_Position=projectionMatrix*viewMatrix*vec4(p,1.0);
}`;
export const FILM_FS = `uniform sampler2D map; uniform sampler2D tMarks; uniform vec3 uMask; uniform float uGate, uDevK, uHideX, uHide;
varying vec2 vUv; varying vec2 vG;
void main(){
  vec4 t=texture2D(map,vUv); vec4 m=texture2D(tMarks,vUv);
  float ax=abs(vG.x);
  float gate=1.0-smoothstep(uGate-1.5,uGate+7.0,ax);
  float light=0.14+0.5*exp(-vG.x*vG.x/(2.0*120.0*120.0))+gate*0.95;
  float dev=(1.0-smoothstep(uGate-5.0,uGate+14.0,ax))*uDevK;
  vec3 c=t.rgb;
  vec3 neg=(1.0-c*0.9)*uMask;
  vec3 col=mix(neg*light,c*mix(0.55,1.0,gate),dev);   // in the light: the positive with its own exposure, not blown out
  float hide=uHide*(1.0-smoothstep(${(FW / 2 - 0.5).toFixed(1)},${(FW / 2 + 0.5).toFixed(1)},abs(vG.x-uHideX)))*(1.0-smoothstep(${(FH / 2 - 0.5).toFixed(1)},${(FH / 2 + 0.5).toFixed(1)},abs(vG.y)));
  col=mix(col,vec3(0.025),hide);
  col=mix(col,m.rgb*(0.45+0.55*min(light,1.0)),m.a*0.95);
  float a=max(smoothstep(0.35,0.65,t.a),m.a);
  gl_FragColor=vec4(col,a);
}`;

const GATE_VS = `varying vec2 vL; void main(){ vL=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;

/** The light window behind the film + the warm halo in front. */
export function addLight(scene: Scene) {
  const gateMat = new ShaderMaterial({
    uniforms: { uFlick: { value: 1 } }, transparent: true, depthWrite: false, vertexShader: GATE_VS,
    fragmentShader: `uniform float uFlick; varying vec2 vL;
  float sdR(vec2 p, vec2 b, float r){ vec2 q=abs(p)-b+r; return length(max(q,0.0))+min(max(q.x,q.y),0.0)-r; }
  void main(){
    float d=sdR(vL,vec2(${(GATE + 3).toFixed(1)},${(STRIP_H / 2 + 6).toFixed(1)}),3.0);
    float core=1.0-smoothstep(-1.0,1.5,d);
    float glow=exp(-max(d,0.0)/18.0)*0.42+exp(-max(d,0.0)/150.0)*0.16;
    vec3 col=vec3(1.0,0.96,0.88)*core+vec3(1.0,0.8,0.58)*glow*(1.0-core);
    gl_FragColor=vec4(col*uFlick,max(core,glow));
  }`,
  });
  const gate = new Mesh(new PlaneGeometry(900, 600), gateMat);
  gate.position.z = -30; gate.renderOrder = 0; scene.add(gate);
  const haloMat = new ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, blending: AdditiveBlending, vertexShader: GATE_VS,
    fragmentShader: `varying vec2 vL; void main(){ float r=length(vL*vec2(0.8,1.0)); gl_FragColor=vec4(vec3(1.0,0.42,0.22)*0.13*exp(-r*r/(2.0*34.0*34.0)),1.0); }`,
  });
  const halo = new Mesh(new PlaneGeometry(300, 200), haloMat);
  halo.position.z = 8; halo.renderOrder = 50; scene.add(halo);
  return { gateMat };
}
