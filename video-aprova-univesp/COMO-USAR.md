# Vídeo de apresentação do Aprova UNIVESP

Vídeo de 2 minutos e 13 segundos em português, com textos animados, imagens reais do site e QR code de acesso. Narração sintética em português brasileiro com a voz Microsoft Maria do Windows, sem trilha sonora. Formato horizontal Full HD, 1920 × 1080, 30 quadros por segundo.

O texto da narração está em `narracao.json`. Para gerar novamente os arquivos de áudio no Windows com a voz Maria instalada, execute `./generate-narration.ps1`. Cada cena tem um arquivo de áudio independente em `public/narracao/`.

## Assistir e editar

Na pasta deste projeto, execute:

```powershell
npx remotion studio --no-open --port=3201
```

Abra http://localhost:3201/Aprova-UNIVESP e clique em Play. O botão de tela cheia amplia a prévia. Cada cena também pode ser aberta separadamente na pasta Cenas.

## Exportar quando necessário

No Studio, o botão Render permite gerar o MP4. Também é possível executar:

```powershell
npx remotion render src/index.ts Aprova-UNIVESP out/Aprova-UNIVESP.mp4
```

## Conteúdo

1. Abertura e acesso gratuito.
2. Catálogo, simulados e histórico individual.
3. Cadastro com e-mail institucional.
4. Primeiro treino por matéria.
5. Revisão dos erros, flashcards e Meu plano.
6. Sugestões e uso responsável.
7. Convite para começar, endereço público e QR code.

Fontes: README e páginas do projeto. Imagens da página inicial e do cadastro capturadas do site público em 7 de outubro de 2026. Os números da página inicial são exemplos ilustrativos. Iniciativa independente, sem vínculo oficial com a Univesp.
