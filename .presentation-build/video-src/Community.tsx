import {Interactive} from 'remotion';
import {Scene} from './Scene';
export const Community=()=> <Scene>
 <Interactive.Div name="Título" style={{position:'absolute',left:150,top:140,width:1650,fontSize:112,fontWeight:700,lineHeight:1.12}}>Sua contribuição<br/>ajuda a comunidade.</Interactive.Div>
 <Interactive.Div name="Contato" style={{position:'absolute',left:150,top:530,width:1620,fontSize:64,lineHeight:1.3}}>Envie sugestões e relate erros<br/>em “Falar com admin”.</Interactive.Div>
 <Interactive.Div name="Uso responsável" style={{position:'absolute',left:150,top:785,width:1610,fontSize:48,lineHeight:1.35,color:'#c4b5fd'}}>Confira as respostas com o material da disciplina.<br/>O treino apoia seus estudos e não garante aprovação.</Interactive.Div>
</Scene>;
