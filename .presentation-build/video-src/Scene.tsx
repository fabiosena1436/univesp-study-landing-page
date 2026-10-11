import React from 'react';
import {AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';

export const Scene: React.FC<{children: React.ReactNode; light?: boolean}> = ({children, light=false}) => {
  const frame=useCurrentFrame();
  const {durationInFrames}=useVideoConfig();
  return <AbsoluteFill style={{background:light?'#f6f7fb':'#111827',color:light?'#172033':'#ffffff',fontFamily:'Arial, sans-serif'}}>
    <Interactive.Div name="Luz violeta" style={{position:'absolute',width:1200,height:1200,borderRadius:600,right:-600,top:-600,background:'radial-gradient(circle, #7c3aed44, #7c3aed00 70%)',scale:interpolate(frame,[0,420],[0.9,1.2],{extrapolateRight:'clamp',extrapolateLeft:'clamp',output:'perceptual-scale'})}} />
    <Interactive.Div name="Conteúdo da cena" style={{position:'absolute',inset:0,opacity:interpolate(frame,[0,18,durationInFrames-18,durationInFrames-1],[0,1,1,0],{extrapolateRight:'clamp',extrapolateLeft:'clamp'}),translate:interpolate(frame,[0,24],['0px 28px','0px 0px'],{extrapolateRight:'clamp',extrapolateLeft:'clamp',easing:Easing.bezier(0.16,1,0.3,1)})}}>{children}</Interactive.Div>
  </AbsoluteFill>;
};
