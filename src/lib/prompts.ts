type Stage = 'T' | 'A' | 'Ds' | 'DI' | 'E';

const STAGE_PROMPTS: Record<Stage, string> = {
  T: `당신은 협력적 수업설계를 지원하는 AI 어시스턴트 Minerva입니다.
현재 단계: 팀 준비(T) 단계입니다.
교사 팀이 협력적 수업설계의 비전을 설정하고, 역할을 분담하며 팀 운영 구조를 수립하는 단계입니다.
팀원들이 공통의 교육적 비전을 발견하고, 각자의 강점에 맞는 역할을 정하도록 도와주세요.
구체적이고 실천 가능한 조언을 제공하고, 필요시 웹 검색을 통해 최신 교육 트렌드와 사례를 참고하세요.`,

  A: `당신은 협력적 수업설계를 지원하는 AI 어시스턴트 Minerva입니다.
현재 단계: 분석(A) 단계입니다.
교사 팀이 수업 주제를 선정하고, 핵심 아이디어와 성취기준을 분석하며 통합된 수업 목표를 진술하는 단계입니다.
교육과정 문서, 성취기준, 관련 교육 자료를 참고하여 팀이 명확한 학습 목표를 수립하도록 지원하세요.
필요시 웹 검색을 통해 관련 교육과정 자료와 사례를 제공하세요.`,

  Ds: `당신은 협력적 수업설계를 지원하는 AI 어시스턴트 Minerva입니다.
현재 단계: 설계(Ds) 단계입니다.
교사 팀이 평가 계획, 문제 상황, 학습 활동, 지원 도구, 스캐폴딩을 설계하는 단계입니다.
백워드 설계 원리에 따라 평가를 먼저 설계하고, 그에 맞는 학습 활동을 구성하도록 도와주세요.
실제적이고 의미 있는 문제 상황과 다양한 지원 전략을 제안하세요. 필요시 웹 검색을 활용하세요.`,

  DI: `당신은 협력적 수업설계를 지원하는 AI 어시스턴트 Minerva입니다.
현재 단계: 개발/실행(DI) 단계입니다.
교사 팀이 수업 자료를 개발하고, AI 프로토타이핑을 수행하며 실제 수업을 실행하는 단계입니다.
수업 자료 개발, AI 도구 활용, 수업 시뮬레이션, 실제 수업 기록 등을 지원하세요.
구체적인 교수학습 자료 예시와 피드백을 제공하고, 필요시 웹 검색으로 참고 자료를 찾아드리세요.`,

  E: `당신은 협력적 수업설계를 지원하는 AI 어시스턴트 Minerva입니다.
현재 단계: 평가/성찰(E) 단계입니다.
교사 팀이 수업 실행 결과를 성찰하고, 협력적 수업설계 과정 전반을 평가하는 단계입니다.
데이터 기반의 성찰과 개선 방향을 도출하도록 지원하고, 다음 수업설계 사이클에 반영할 인사이트를 제공하세요.
팀의 협력 과정과 성과를 긍정적으로 인정하면서 건설적인 피드백을 제공하세요.`,
};

export function loadSystemPrompt(stage: string): string {
  return STAGE_PROMPTS[(stage as Stage)] ?? STAGE_PROMPTS['T'];
}

interface PageContext {
  projectTitle?: string;
  activePhase?: string;
  activeSection?: string;
  activityInputs?: Record<string, string>;
  selectedActivityCode?: string;
  referenceFiles?: { name: string; mime: string; content?: string; pdfData?: string }[];
}

export function buildPageContextBlock(ctx: PageContext): string {
  const lines: string[] = [];

  lines.push('---');
  lines.push('## 현재 워크스페이스 상태 (참고용)');

  if (ctx.projectTitle) {
    lines.push(`- 프로젝트명: ${ctx.projectTitle}`);
  }
  if (ctx.activePhase) {
    lines.push(`- 현재 단계: ${ctx.activePhase}`);
  }
  if (ctx.activeSection) {
    lines.push(`- 현재 섹션: ${ctx.activeSection}`);
  }

  if (ctx.selectedActivityCode) {
    lines.push(`- 현재 선택된 활동 카드: **[${ctx.selectedActivityCode}]**`);
    const selectedText = ctx.activityInputs?.[ctx.selectedActivityCode]?.trim();
    if (selectedText) {
      lines.push('');
      lines.push('### 선택된 활동 카드 내용 (주요 참고)');
      lines.push(`**[${ctx.selectedActivityCode}]**`);
      lines.push(selectedText);
    }
  }

  const filled = Object.entries(ctx.activityInputs ?? {})
    .filter(([code, v]) => v.trim() && code !== ctx.selectedActivityCode);
  if (filled.length > 0) {
    lines.push('');
    lines.push('### 팀이 작성한 다른 활동 내용');
    for (const [code, value] of filled) {
      lines.push(`**[${code}]**`);
      lines.push(value.trim());
    }
  }

  if (ctx.referenceFiles && ctx.referenceFiles.length > 0) {
    lines.push('');
    lines.push('### 업로드된 참고자료');
    for (const f of ctx.referenceFiles) {
      if (f.content) {
        lines.push(`**[${f.name}]**`);
        lines.push(f.content.length > 3000 ? f.content.slice(0, 3000) + '\n…(이하 생략)' : f.content);
      } else {
        lines.push(`**[${f.name}]** (${f.mime || '파일'}) — 텍스트 추출 불가`);
      }
    }
    lines.push('');
    lines.push('위 참고자료를 바탕으로 팀의 질문에 구체적으로 답변하세요.');
  }

  lines.push('---');
  if (ctx.selectedActivityCode) {
    lines.push(`사용자가 [${ctx.selectedActivityCode}] 카드를 선택하여 대화를 시작했습니다. 이 활동과 관련하여 도움을 제공하세요.`);
  } else {
    lines.push('위 내용을 바탕으로 팀의 현재 진행 상황을 파악하고, 질문에 답변하거나 구체적인 제안을 제공하세요.');
  }

  return lines.join('\n');
}
