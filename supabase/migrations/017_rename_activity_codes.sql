-- 017: 카드 코드 3단계(T-1-1) → 2단계(T-1) 재부여
-- activity_contents.activity_code 를 새 코드 체계로 이관한다.
--   · 카드 행: activity_code 가 옛 코드와 정확히 일치
--   · 의견묻기 행: '{옛코드}__{timestamp}__opinion', '..._opinion_res_{uid}' → 접두사 치환
-- 제거된 카드(스캐폴딩 Ds-2-2, 학습자 분석, 유령 DI-1-2/DI-2-2)는 삭제한다.
-- 옛 코드는 새 코드의 접두사가 아니므로(예: 'T-1-1' 은 'T-1__%' 에 매칭되지 않음) 치환이 안전하다.

begin;

-- 1) 제거된 카드 삭제 (카드 + 의견 행)
delete from public.activity_contents
where activity_code in ('Ds-2-2', '학습자 분석', 'DI-1-2', 'DI-2-2')
   or activity_code like 'Ds-2-2\_\_%'
   or activity_code like '학습자 분석\_\_%'
   or activity_code like 'DI-1-2\_\_%'
   or activity_code like 'DI-2-2\_\_%';

-- 2) 옛 코드 → 새 코드 이관 (충돌 시 옛 내용 우선)
do $$
declare
  m record;
begin
  for m in
    select * from (values
      ('T-1-1','T-1'), ('T-1-2','T-2'), ('T-2-1','T-3'), ('T-2-2','T-4'), ('T-2-3','T-5'),
      ('A-1-1','A-1'), ('A-1-2','A-2'), ('A-2-1','A-3'), ('A-2-2','A-4'),
      ('Ds-1-1','Ds-1'), ('Ds-1-2','Ds-2'), ('Ds-1-3','Ds-3'), ('Ds-2-1','Ds-4'),
      ('DI-1-1','DI-1'), ('DI-2-1','DI-2'),
      ('E-1-1','E-1'), ('E-2-1','E-2')
    ) as t(old_code, new_code)
  loop
    -- 코드 변경 후 앱이 만든 새 코드 행이 같은 lesson 에 이미 있고,
    -- 대응되는 옛 코드 행이 존재하면 → 새 코드 행을 삭제 (옛 내용 우선)
    delete from public.activity_contents t
    where exists (
      select 1 from public.activity_contents s
      where s.lesson_id = t.lesson_id
        and (s.activity_code = m.old_code or s.activity_code like m.old_code || '\_\_%')
        and m.new_code || substring(s.activity_code from char_length(m.old_code) + 1) = t.activity_code
    );

    -- 옛 코드 → 새 코드 (접두사만 치환, 나머지 접미사 유지)
    update public.activity_contents
    set activity_code = m.new_code || substring(activity_code from char_length(m.old_code) + 1)
    where activity_code = m.old_code
       or activity_code like m.old_code || '\_\_%';
  end loop;
end $$;

commit;
