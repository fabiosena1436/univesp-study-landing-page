import {Interactive,interpolate,staticFile,useCurrentFrame} from 'remotion';
import {Audio} from '@remotion/media';
import {Scene} from './Scene';
export const Review=()=>{
 const frame=useCurrentFrame();
 return <Scene light>
  <Audio name="Narração da revisão" src={staticFile('narracao/review.wav')} from={20}/>
  <Interactive.Div name="Título" style={{position:'absolute',left:150,top:120,width:1620,fontSize:108,fontWeight:700}}>O treino continua na revisão</Interactive.Div>
  <Interactive.Div name="Revisão dos erros" style={{position:'absolute',left:150,top:365,width:1520,fontSize:66,lineHeight:1.3}}><span style={{fontWeight:700,color:'#4f46e5'}}>Errou?</span> Treine novamente com o filtro<br/>“Só as questões que eu já errei”.</Interactive.Div>
  <Interactive.Div name="Flashcards" style={{position:'absolute',left:150,top:595,width:1520,fontSize:66,lineHeight:1.3,opacity:interpolate(frame,[65,85],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}}><span style={{fontWeight:700,color:'#4f46e5'}}>Flashcards:</span> tente lembrar antes de revelar.</Interactive.Div>
  <Interactive.Div name="Meu plano" style={{position:'absolute',left:150,top:790,width:1520,fontSize:66,lineHeight:1.3,opacity:interpolate(frame,[145,165],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}}><span style={{fontWeight:700,color:'#4f46e5'}}>Meu plano:</span> acompanhe as próximas revisões.</Interactive.Div>
 </Scene>;
};
