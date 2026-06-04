import time
import re
import pymysql
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

# ⚙️ MySQL 접속 정보 설정
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'Alstmd0713@',
    'db': 'CORE_User_Database',
    'charset': 'utf8mb4',
    'cursorclass': pymysql.cursors.DictCursor
}

def extract_pure_data(text_area):
    if not text_area: return ""
    clean_text = text_area.replace("space_bar", " ").replace("keyboard_return", "\n").replace("content_copy", "").replace("chevron_right", "")
    
    lines = clean_text.split('\n')
    data_lines = []
    ban_words = ["logout", "login", "jungol", "call", "fax", "email", "place", "version", "@seo-rii", "태그", "출처"]
    
    for line in lines:
        line = line.strip()
        if not line: continue
        if not re.search('[가-힣]', line) and re.search('[0-9a-zA-Z!]', line):
            if not any(ban in line.lower() for ban in ban_words):
                data_lines.append(line)
                
    return "\n".join(data_lines)

def save_split_testcases(problem_id, input_raw, output_raw):
    """ 세트별로 쪼개서 개별 Row로 저장 (기존 데이터는 삭제 후 갱신) """
    input_lines = [line.strip() for line in input_raw.split('\n') if line.strip() and line.strip() != "0 0"]
    output_lines = [line.strip() for line in output_raw.split('\n') if line.strip()]
    
    if not input_lines and not output_lines:
        return False
        
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            # 기존에 해당 문제 번호로 저장된 데이터가 있다면 싹 밀기
            delete_sql = "DELETE FROM test_cases WHERE problem_id = %s"
            cursor.execute(delete_sql, (problem_id,))
            
            inserted_count = 0
            for inp, outp in zip(input_lines, output_lines):
                insert_sql = """
                    INSERT INTO test_cases (problem_id, input_data, expected_output, is_example)
                    VALUES (%s, %s, %s, 0)
                """
                cursor.execute(insert_sql, (problem_id, inp, outp))
                inserted_count += 1
                
        connection.commit()
        print(f"   -> 💾 DB 저장 완료 ({inserted_count}개 세트 분할 저장됨)")
        return True
    except Exception as e:
        print(f"   -> ❌ DB 저장 실패: {e}")
        return False
    finally:
        if connection: connection.close()

def main_bulk_crawler(start_num, end_num):
    chrome_options = Options()
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option('useAutomationExtension', False)
    
    # 팁: 대량 크롤링할 때는 브라우저 창을 숨기는 headless 모드를 쓰면 훨씬 빠르고 쾌적합니다.
    # 창을 보고 싶으시면 아래 라인 주석 처리 하세요.
    chrome_options.add_argument("--headless") 
    
    driver = webdriver.Chrome(options=chrome_options)
    
    print(f"🚀 정올 {start_num}번부터 {end_num}번까지 연쇄 크롤링을 시작합니다.")
    
    try:
        for p_num in range(start_num, end_num + 1):
            problem_id = str(p_num)
            url = f"https://www.jungol.co.kr/problem/{problem_id}"
            
            print(f"\n[{problem_id}번 문제] 수집 시도 중...")
            
            try:
                driver.get(url)
                # 첫 로딩은 4초 대기, 루프 도중에는 페이지가 가벼우므로 2~3초로 조절 가능
                time.sleep(1) 
                
                body_text = driver.find_element(By.TAG_NAME, "body").text
                
                if "입력" in body_text and "출력" in body_text:
                    raw_input_area = body_text.split("입력")[-1].split("출력")[0]
                    raw_output_area = body_text.split("출력")[-1].split("정답")[0].split("목록")[0]
                    
                    input_result = extract_pure_data(raw_input_area)
                    output_result = extract_pure_data(raw_output_area)
                    
                    success = save_split_testcases(problem_id, input_result, output_result)
                    if not success:
                        print("   -> ⚠️ 추출된 데이터가 비어있어 스킵합니다. (없는 문제이거나 양식 다름)")
                else:
                    print("   -> ⚠️ '입력/출력' 구조를 찾지 못했습니다. (스킵)")
                    
            except Exception as e:
                print(f"   -> ❌ 문제 처리 중 에러 발생 (패스하고 다음 문제로): {e}")
            
            # 정올 서버 보호 및 IP 차단 방지를 위한 필수 휴식 타임 (1초)
            time.sleep(1)
            
    finally:
        driver.quit()
        print("\n🏁 모든 대량 크롤링 작업이 종료되었습니다!")

if __name__ == "__main__":
    # 🎯 3556번부터 5245번까지 지정
    START_PROBLEM = 3556
    END_PROBLEM = 5245
    
    main_bulk_crawler(START_PROBLEM, END_PROBLEM)
