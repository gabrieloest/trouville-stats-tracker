# 🏀 Trouville Stats Tracker

Aplicação web simples e responsiva (*one-pager*) desenvolvida em arquivo único (HTML, CSS e JavaScript) para registrar estatísticas individuais de jogos de basquete à beira da quadra, com exportação rápida e formatada para compartilhamento no WhatsApp.

## ✨ Funcionalidades

- **Configuração da Partida:** Definição do time adversário e do mando de jogo (Casa ou Fora), ajustando automaticamente o cabeçalho do confronto.
- **Seleção Flexível de Tempos:** Suporte para até 6 períodos (7 minutos cada), permitindo marcar apenas os tempos em que o jogador entrou em quadra — mesmo que não sejam consecutivos.
- **Contadores Rápidos:** Botões grandes de `+` e `-` otimizados para uso mobile (pontos, rebotes, assistências, roubos de bola e tocos).
- **Exportação para WhatsApp:** Pré-visualização em tempo real e cópia para a área de transferência com apenas um toque.

## 📱 Formato de Saída

Ao clicar em **Copiar para WhatsApp**, o texto é gerado exatamente no seguinte padrão:

```text
Trouville x  Capitol
- Jogo 1
 12 pts, 3 Rb, 1 ass, 1 roubos, 0 tocos
- Jogo 3
 8 pts, 2 Rb, 3 ass, 1 roubos, 0 tocos
- Jogo 5
 6 pts, 3 Rb, 2 ass, 0 roubos, 1 tocos
