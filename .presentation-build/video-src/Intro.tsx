import {Interactive, interpolate, useCurrentFrame} from 'remotion';
import {Scene} from './Scene';
export const Intro=()=>{
 const frame=useCurrentFrame();
 return <Scene>
  <Interactive.Div name="Marca" style={{position:'absolute',left:150,top:130,fontSize:52,fontWeight:700,color:'#a78bfa'}}>Aprova UNIVESP</Interactive.Div>
  <Interactive.Div name="Título de abertura" style={{position:'absolute',left:150,top:295,width:1580,fontSize:132,fontWeight:700,lineHeight:1.08}}>Um espaço para<br/>praticar e revisar.</Interactive.Div>
  <Interactive.Div name="Comunidade" style={{position:'absolute',left:150,top:690,width:1550,fontSize:59,lineHeight:1.3,opacity:interpolate(frame,[30,48],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}}>Gratuito para a comunidade da Univesp.</Interactive.Div>
  <Interactive.Div name="Independência do projeto" style={{position:'absolute',left:150,top:930,fontSize:34,color:'#c4b5fd'}}>Iniciativa independente de apoio aos estudos</Interactive.Div>
 </Scene>;
};
