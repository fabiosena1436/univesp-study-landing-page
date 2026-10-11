import fs from 'node:fs/promises';
import path from 'node:path';
import { Presentation, PresentationFile } from 'file:///C:/Users/fabio/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';
import { finalizePresentation } from 'file:///C:/Users/fabio/.codex/plugins/cache/openai-primary-runtime/presentations/26.1005.12141/skills/presentations/container_tools/artifact_tool_utils.mjs';
const root='C:/projetos-sites-guit/univesp-study-landing-page';
const build=path.join(root,'.presentation-build');
const output=path.join(root,'apresentacao-comunidade');
const skill='C:/Users/fabio/.codex/plugins/cache/openai-primary-runtime/presentations/26.1005.12141/skills/presentations';
const url='https://univesp-study-landing-page.vercel.app/';
process.env.RUNTIME_NODE_MODULES='C:/Users/fabio/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
await fs.mkdir(output,{recursive:true});
const p=Presentation.create({slideSize:{width:1280,height:720}});
const C={dark:'#111827',ink:'#172033',paper:'#F6F7FB',purple:'#4F46E5',lilac:'#A78BFA',muted:'#536078'};
function text(s,txt,x,y,w,h,size=30,color=C.ink,bold=false){
 const t=s.shapes.add({geometry:'textbox',name:txt.slice(0,45),position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
 t.text=txt;t.text.style={typeface:'Arial',fontSize:size,color,bold,verticalAlignment:'top',insets:0,autoFit:'none'};return t;
}
function slide(title,note,sources=[],dark=false){
 const s=p.slides.add();s.background.fill=dark?C.dark:C.paper;
 text(s,title,80,65,1120,115,48,dark?'#FFFFFF':C.ink,true);
 text(s,String(p.slides.items.length).padStart(2,'0'),1150,663,50,30,18,dark?C.lilac:C.muted);
 s.speakerNotes.text=note+'\n\nFontes: '+sources.map(x=>x.startsWith('http')?x:path.join(root,x)).join('\n');
 return s;
}
function item(s,label,body,y){text(s,label,80,y,400,55,33,C.purple,true);text(s,body,525,y,660,90,29);}
async function image(s,name,pos){const bytes=await fs.readFile(path.join(build,name));s.images.add({blob:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),contentType:'image/png',alt:'Tela real do Aprova UNIVESP',fit:'contain',position:pos});}
let s=slide('Aprova UNIVESP','Tempo sugerido: 35 segundos. Olá, pessoal! Quero apresentar o Aprova UNIVESP, um projeto de estudos para nossa comunidade. A proposta é usar questões para praticar e entender o que ainda precisamos revisar. O acesso é gratuito. Sou Fabio VSena, responsável pelo projeto. Esta é uma iniciativa independente, sem vínculo oficial com a universidade.',['README.md','src/app/termos/page.tsx'],true);
text(s,'Um espaço gratuito\npara praticar e revisar',80,235,1060,180,62,'#FFFFFF',true);
text(s,'Apresentação para a comunidade da Univesp',80,460,1060,60,30,C.lilac);
text(s,'Fabio VSena\nIniciativa independente de apoio aos estudos',80,584,1030,70,24,'#FFFFFF');
s=slide('O projeto na prática','Tempo sugerido: 40 segundos. Esta é a página inicial real do projeto. Ela apresenta um catálogo compartilhado, simulados e acompanhamento individual. Os números visíveis na imagem são exemplos da página, não resultados de alunos. Nossa proposta é facilitar a prática com o conteúdo disponível, sem prometer aprovação.',[url,'src/app/page.tsx']);
await image(s,'site.png',{left:80,top:186,width:810,height:456});
text(s,'Questões\npor matéria',930,218,270,100,32,C.purple,true);
text(s,'Treino com\ncorreção',930,358,270,100,32,C.purple,true);
text(s,'Histórico\nindividual',930,498,270,100,32,C.purple,true);
text(s,'Os indicadores na imagem são exemplos da página inicial.',80,650,1020,30,18,C.muted);
s=slide('O que você pode usar','Tempo sugerido: 50 segundos. O catálogo agrupa questões por matéria. Em Nova prova, você monta seu treino com o conteúdo disponível. O histórico reúne seus resultados. Flashcards e Meu plano ajudam a continuar a revisão. As opções e a quantidade de questões dependem das matérias publicadas pelos administradores.',['src/components/AppShell.tsx','src/app/app/prova/page.tsx','src/app/app/flashcards/page.tsx','src/app/app/plano/page.tsx']);
item(s,'Nova prova','Treinos por matéria, com gabarito e feedback disponível.',210);
item(s,'Histórico','Resultados das suas provas para acompanhar a prática.',345);
item(s,'Flashcards e Meu plano','Cartões de revisão e questões programadas para voltar.',480);
s=slide('Cadastro e primeiro acesso','Tempo sugerido: 55 segundos. Abra o endereço do projeto e escolha Criar conta grátis. Informe nome, e-mail institucional, curso e uma senha com pelo menos oito caracteres. Confirme a senha. O cadastro libera acesso imediato, sem confirmação por e-mail. Quem já tem conta usa Entrar. Leia os termos e a política de privacidade antes de concluir. Não peça que alguém compartilhe sua senha.',[url+'cadastro','src/app/cadastro/page.tsx']);
text(s,'1. Abra o site e escolha\nCriar conta grátis',80,205,530,100,32,C.purple,true);
text(s,'2. Informe nome, curso e\ne-mail @aluno.univesp.br',80,340,530,100,30);
text(s,'3. Crie e confirme uma senha\ncom pelo menos 8 caracteres',80,468,530,100,30);
text(s,'Acesso imediato após o cadastro',80,602,535,50,26,C.purple,true);
await image(s,'cadastro.png',{left:657,top:190,width:535,height:420});
s=slide('Seu primeiro treino','Tempo sugerido: 55 segundos. Depois de entrar, abra Nova prova. Escolha uma matéria publicada e a quantidade de questões. Para começar, sugiro cinco questões, se houver essa quantidade disponível. Responda e conclua o treino. Confira os acertos e leia o feedback disponível, especialmente nas questões erradas. Se quiser demonstrar ao vivo, faça agora esse percurso com sua própria conta.',['src/app/app/prova/page.tsx']);
const steps=[['01','Nova prova','Escolha uma matéria publicada.'],['02','Quantidade','Comece com 5 questões, se disponíveis.'],['03','Respostas','Responda e conclua o treino.'],['04','Resultado','Confira os acertos e o feedback disponível.']];
steps.forEach((a,i)=>{const y=205+i*108;text(s,a[0],80,y,85,55,40,C.purple,true);text(s,a[1],205,y,330,55,32,C.ink,true);text(s,a[2],575,y,620,75,29);});
s=slide('Revisão depois do treino','Tempo sugerido: 55 segundos. O erro mostra o que merece uma nova tentativa. Em Nova prova, o filtro Só as questões que eu já errei direciona o treino. Em Meu plano, responda a revisão e avalie como foi. Difícil traz a questão de volta mais cedo, enquanto Fácil amplia o intervalo. Nos flashcards, tente lembrar antes de revelar a resposta. A fila depende do seu uso, por isso faça uma prova para começar.',['src/app/app/plano/page.tsx','src/app/app/flashcards/page.tsx','src/app/app/prova/page.tsx']);
item(s,'Questões que eu já errei','Um filtro para concentrar o treino nas suas dificuldades.',210);
item(s,'Meu plano','Revisões programadas conforme sua avaliação de dificuldade.',345);
item(s,'Flashcards','Tente lembrar, revele a resposta e avalie como foi.',480);
s=slide('Uma comunidade que contribui','Tempo sugerido: 45 segundos. Os administradores publicam e revisam as matérias, questões e materiais. Você pode contribuir enviando sugestões ou apontando problemas pelo canal Falar com admin. Se encontrar uma resposta duvidosa, inclua a matéria e o enunciado para facilitar a conferência. Quem quiser sugerir material deve enviar somente conteúdo que tenha autorização para compartilhar. O aluno não precisa importar arquivos para começar.',['src/app/app/contato/page.tsx','src/app/termos/page.tsx','README.md']);
text(s,'O catálogo é compartilhado.\nO progresso é de cada aluno.',80,205,1120,155,48,C.purple,true);
text(s,'Administradores revisam e publicam o conteúdo.',80,405,1100,65,30);
text(s,'Você envia sugestões e relata erros em Falar com admin.',80,490,1100,70,30);
text(s,'Materiais para contribuição precisam de autorização de compartilhamento.',80,585,1110,65,26,C.muted);
s=slide('Estudo com responsabilidade','Tempo sugerido: 45 segundos. O Aprova UNIVESP apoia a preparação e não substitui as aulas e os materiais oficiais. É uma iniciativa independente. Questões e explicações podem conter erros, inclusive quando há apoio de IA, então confira com o conteúdo da disciplina e reporte divergências. O resultado do treino não é nota oficial nem garantia de aprovação. O perfil oferece exportação de dados e encerramento da conta.',['src/app/termos/page.tsx','src/app/privacidade/page.tsx','README.md']);
text(s,'Apoio à preparação para as disciplinas',80,218,1090,70,38,C.purple,true);
text(s,'Continue usando as aulas e os materiais oficiais da Univesp.',80,328,1090,70,30);
text(s,'Confira respostas e explicações. Relate divergências ao administrador.',80,425,1090,85,30);
text(s,'Os resultados de treino não são notas oficiais nem garantia de aprovação.',80,536,1090,85,30);
s=slide('Seu primeiro treino pode ser hoje','Tempo sugerido: 40 segundos. O convite é simples: abra o site, crie sua conta e faça um treino curto em uma matéria disponível. Depois, confira os erros e volte para revisar. Vou deixar o endereço na tela. Se tiverem dúvidas, usem Falar com admin ou meu e-mail. Quem experimentar pode contar o que funcionou e o que precisa melhorar. Obrigado!',[url,'src/app/app/contato/page.tsx'],true);
text(s,'Acesse gratuitamente',80,213,1110,65,38,C.lilac,true);
const link=text(s,'univesp-study-landing-page.vercel.app',80,310,1120,90,42,'#FFFFFF',true);link.text.get('univesp-study-landing-page.vercel.app').link={uri:url,isExternal:true};
text(s,'Crie sua conta com o e-mail institucional\ne pratique com uma matéria disponível.',80,442,1100,110,32,'#FFFFFF');
text(s,'Dúvidas e sugestões: Falar com admin\nFabio VSena  /  fabiosena1436@gmail.com',80,586,1100,72,25,C.lilac);
await (await PresentationFile.exportPptx(p)).save(path.join(build,'candidate.pptx'));
const result=await finalizePresentation({workspaceDir:root,candidatePath:path.join(build,'candidate.pptx'),finalPath:path.join(output,'Aprova-UNIVESP-comunidade.pptx'),pythonExecutable:'C:/Users/fabio/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit'],explicitTotalSlideCount:9,requiredNativeTableOwnerSlides:[],requiredNativeChartOwnerSlides:[],fontPolicy:{basis:'design',families:['Arial']},verifyArtifactToolImport:true,receiptPath:path.join(build,'validation.json')});
console.log(JSON.stringify(result));
for(let i=0;i<p.slides.items.length;i++) {const png=await p.export({slide:p.slides.items[i],format:'png',scale:1});await fs.writeFile(path.join(build,`slide-${i+1}.png`),new Uint8Array(await png.arrayBuffer()));}
const pdf=await p.export({format:'pdf'});await fs.writeFile(path.join(output,'Aprova-UNIVESP-comunidade.pdf'),new Uint8Array(await pdf.arrayBuffer()));
await fs.writeFile(path.join(output,'Roteiro-de-apresentacao.md'),'# Aprova UNIVESP\n\nApresentação para a comunidade. Duração sugerida: cerca de 7 minutos.\n\n'+p.slides.items.map((sl,i)=>`## Slide ${i+1}\n\n${sl.speakerNotes.text.split('\n\nFontes:')[0]}\n`).join('\n'));
console.log('Concluído: PPTX, PDF e roteiro.');

