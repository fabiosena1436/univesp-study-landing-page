import {CanvasImage, Interactive,staticFile,interpolate,useCurrentFrame} from 'remotion';
import {Scene} from './Scene';
export const Signup=()=>{
 const frame=useCurrentFrame();
 return <Scene light>
  <Interactive.Div name="Título" style={{position:'absolute',left:150,top:110,width:1630,fontSize:104,fontWeight:700}}>Sua conta, sem complicação</Interactive.Div>
  <Interactive.Div name="Primeiro passo" style={{position:'absolute',left:150,top:345,width:790,fontSize:62,lineHeight:1.25,fontWeight:700,color:'#4f46e5'}}>Escolha “Criar conta grátis”.</Interactive.Div>
  <Interactive.Div name="Dados para cadastro" style={{position:'absolute',left:150,top:530,width:790,fontSize:58,lineHeight:1.3,opacity:interpolate(frame,[45,65],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}}>Informe nome, curso e<br/>e-mail @aluno.univesp.br.</Interactive.Div>
  <Interactive.Div name="Senha" style={{position:'absolute',left:150,top:750,width:790,fontSize:58,lineHeight:1.3,opacity:interpolate(frame,[90,110],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}}>Crie e confirme uma senha<br/>com pelo menos 8 caracteres.</Interactive.Div>
  <CanvasImage src={staticFile('cadastro-form.png')} style={{position:'absolute',left:1120,top:295,width:600,height:690,objectFit:'contain',borderRadius:18}}/>
 </Scene>;
};
