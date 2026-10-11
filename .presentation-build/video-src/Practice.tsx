import {Interactive,interpolate,useCurrentFrame} from 'remotion';
import {Scene} from './Scene';
export const Practice=()=>{
 const frame=useCurrentFrame();
 return <Scene>
  <Interactive.Div name="Título" style={{position:'absolute',left:150,top:130,width:1630,fontSize:112,fontWeight:700}}>Seu primeiro treino</Interactive.Div>
  <Interactive.Div name="Nova prova" style={{position:'absolute',left:150,top:350,width:1500,fontSize:68,lineHeight:1.25}}><span style={{color:'#a78bfa',fontWeight:700}}>01</span>   Abra “Nova prova” e escolha a matéria.</Interactive.Div>
  <Interactive.Div name="Quantidade" style={{position:'absolute',left:150,top:515,width:1540,fontSize:68,lineHeight:1.25,opacity:interpolate(frame,[65,85],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}}><span style={{color:'#a78bfa',fontWeight:700}}>02</span>   Comece com 5 questões, se disponíveis.</Interactive.Div>
  <Interactive.Div name="Resultado" style={{position:'absolute',left:150,top:690,width:1540,fontSize:68,lineHeight:1.25,opacity:interpolate(frame,[145,165],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}}><span style={{color:'#a78bfa',fontWeight:700}}>03</span>   Responda e confira o resultado.</Interactive.Div>
  <Interactive.Div name="Feedback" style={{position:'absolute',left:150,top:920,width:1540,fontSize:42,color:'#c4b5fd'}}>Leia o feedback disponível, especialmente nas questões erradas.</Interactive.Div>
 </Scene>;
};
