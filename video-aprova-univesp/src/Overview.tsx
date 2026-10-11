import {CanvasImage,Interactive,staticFile} from 'remotion';
import {Audio} from '@remotion/media';
import {Scene} from './Scene';
export const Overview=()=> <Scene light>
 <Audio name="Narração do projeto" src={staticFile('narracao/overview.wav')} from={20}/>
 <Interactive.Div name="Título" style={{position:'absolute',left:150,top:110,width:1650,fontSize:104,fontWeight:700}}>O projeto na prática</Interactive.Div>
 <CanvasImage src={staticFile('site.png')} style={{position:'absolute',left:150,top:310,width:1070,height:604,objectFit:'contain',borderRadius:20}}/>
 <Interactive.Div name="Catálogo" style={{position:'absolute',left:1300,top:360,width:470,fontSize:62,fontWeight:700,lineHeight:1.15,color:'#4f46e5'}}>Questões<br/>por matéria</Interactive.Div>
 <Interactive.Div name="Simulados" style={{position:'absolute',left:1300,top:565,width:470,fontSize:62,fontWeight:700,lineHeight:1.15,color:'#4f46e5'}}>Simulados com<br/>correção</Interactive.Div>
 <Interactive.Div name="Histórico" style={{position:'absolute',left:1300,top:770,width:470,fontSize:62,fontWeight:700,lineHeight:1.15,color:'#4f46e5'}}>Histórico<br/>individual</Interactive.Div>
 <Interactive.Div name="Exemplos ilustrativos" style={{position:'absolute',left:150,top:950,fontSize:30,color:'#536078'}}>Os números da página inicial são exemplos ilustrativos.</Interactive.Div>
</Scene>;
