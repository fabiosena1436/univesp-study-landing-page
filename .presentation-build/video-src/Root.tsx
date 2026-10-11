import {Composition, Folder, Series} from 'remotion';
import {Intro} from './Intro';
import {Overview} from './Overview';
import {Signup} from './Signup';
import {Practice} from './Practice';
import {Review} from './Review';
import {Community} from './Community';
import {Invitation} from './Invitation';

export const Apresentacao=()=> <Series>
 <Series.Sequence name="Abertura" durationInFrames={240}><Intro/></Series.Sequence>
 <Series.Sequence name="O projeto" durationInFrames={360}><Overview/></Series.Sequence>
 <Series.Sequence name="Cadastro" durationInFrames={480}><Signup/></Series.Sequence>
 <Series.Sequence name="Primeiro treino" durationInFrames={480}><Practice/></Series.Sequence>
 <Series.Sequence name="Revisão" durationInFrames={420}><Review/></Series.Sequence>
 <Series.Sequence name="Comunidade" durationInFrames={300}><Community/></Series.Sequence>
 <Series.Sequence name="Convite" durationInFrames={420}><Invitation/></Series.Sequence>
</Series>;

export const RemotionRoot=()=> <>
 <Composition id="Aprova-UNIVESP" component={Apresentacao} durationInFrames={2700} fps={30} width={1920} height={1080}/>
 <Folder name="Cenas">
  <Composition id="Abertura" component={Intro} durationInFrames={240} fps={30} width={1920} height={1080}/>
  <Composition id="Projeto" component={Overview} durationInFrames={360} fps={30} width={1920} height={1080}/>
  <Composition id="Cadastro" component={Signup} durationInFrames={480} fps={30} width={1920} height={1080}/>
  <Composition id="Treino" component={Practice} durationInFrames={480} fps={30} width={1920} height={1080}/>
  <Composition id="Revisao" component={Review} durationInFrames={420} fps={30} width={1920} height={1080}/>
  <Composition id="Comunidade" component={Community} durationInFrames={300} fps={30} width={1920} height={1080}/>
  <Composition id="Convite" component={Invitation} durationInFrames={420} fps={30} width={1920} height={1080}/>
 </Folder>
</>;
