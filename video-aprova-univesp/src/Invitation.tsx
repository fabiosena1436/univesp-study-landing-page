import {Interactive,CanvasImage,staticFile} from 'remotion';
import {Audio} from '@remotion/media';
import {Scene} from './Scene';
export const Invitation=()=> <Scene>
 <Audio name="Narração do convite" src={staticFile('narracao/invitation.wav')} from={20}/>
 <Interactive.Div name="Título" style={{position:'absolute',left:150,top:130,width:1650,fontSize:112,fontWeight:700}}>Seu primeiro treino pode ser hoje.</Interactive.Div>
 <Interactive.Div name="Convite" style={{position:'absolute',left:150,top:395,width:1140,fontSize:66,lineHeight:1.3,color:'#c4b5fd'}}>Crie sua conta gratuitamente.<br/>Escolha uma matéria e comece.</Interactive.Div>
 <Interactive.Div name="Link do projeto" style={{position:'absolute',left:150,top:660,width:1620,fontSize:67,fontWeight:700}}>univesp-study-landing-page.vercel.app</Interactive.Div>
 <Interactive.Div name="Responsável" style={{position:'absolute',left:150,top:910,width:1500,fontSize:38,color:'#c4b5fd'}}>Fabio VSena  ·  fabiosena1436@gmail.com</Interactive.Div>
 <CanvasImage src={staticFile('qr.svg')} style={{position:'absolute',left:1430,top:355,width:310,height:310,borderRadius:14}}/>
</Scene>;

