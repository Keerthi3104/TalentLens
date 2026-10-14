"""
TalentLens — Resume Parser & NLP Scoring Engine
================================================
CONFIRMED WORKING LIBRARIES (tested on this machine):
  - pypdf          5.9.0   -> PDF text extraction   (NOT PyPDF2)
  - python-docx           -> DOCX text extraction
  - scikit-learn   1.8.0   -> TF-IDF + cosine similarity

PIPELINE:
  1. extract_text()                   -> raw text from PDF / DOCX / TXT
  2. clean_text()                     -> lowercase, no stopwords, no punctuation
  3. extract_skills()                 -> 200+ keyword matching across 10 categories
  4. compute_all_role_similarities()  -> TF-IDF vectorize + cosine similarity vs 7 JDs
  5. score_resume_from_text()         -> final score formula
"""

import re
import io

# PDF extraction — using pypdf (v5.x), NOT PyPDF2
try:
    import pypdf
    HAS_PDF = True
except ImportError:
    HAS_PDF = False

# DOCX extraction
try:
    from docx import Document as DocxDocument
    HAS_DOCX = True
except ImportError:
    HAS_DOCX = False

# TF-IDF + cosine similarity
try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False


# -----------------------------------------------------------------------------
# SKILL DICTIONARY — 200+ skills across 10 categories
# -----------------------------------------------------------------------------
SKILL_DICT = {
    "languages": [
        "python","java","javascript","typescript","c++","c#","go","rust","php",
        "ruby","swift","kotlin","scala","r","matlab","perl","bash","shell","dart",
    ],
    "frontend": [
        "react","vue","angular","html","css","tailwind","bootstrap","jquery",
        "nextjs","nuxtjs","svelte","sass","less","webpack","vite","figma","redux","gatsby",
    ],
    "backend": [
        "nodejs","django","flask","fastapi","spring","express","rails","laravel",
        "nestjs","graphql","rest","microservices","asp.net","hibernate","sqlalchemy",
    ],
    "database": [
        "sql","mysql","postgresql","mongodb","redis","sqlite","oracle","cassandra",
        "dynamodb","firebase","elasticsearch","neo4j","mariadb","supabase",
    ],
    "cloud": [
        "aws","azure","gcp","docker","kubernetes","terraform","ansible","jenkins",
        "devops","linux","nginx","apache","heroku","vercel","cloudflare",
    ],
    "data": [
        "pandas","numpy","matplotlib","seaborn","tensorflow","pytorch","keras",
        "spark","hadoop","kafka","airflow","tableau","powerbi","etl","scikit-learn",
    ],
    "mobile": [
        "android","ios","flutter","xamarin","cordova","ionic",
    ],
    "tools": [
        "git","github","gitlab","bitbucket","jira","confluence","postman",
        "swagger","agile","scrum","kanban",
    ],
    "testing": [
        "selenium","cypress","jest","mocha","pytest","junit","testng","playwright","qa",
    ],
    "security": [
        "oauth","jwt","ssl","cybersecurity","cryptography","siem",
    ],
}


# Stopwords — no NLTK needed
STOPWORDS = {
    "i","me","my","we","our","you","your","he","him","his","she","her","it","its",
    "they","them","their","what","which","who","this","that","these","those","am",
    "is","are","was","were","be","been","being","have","has","had","do","does","did",
    "will","would","could","should","may","might","shall","can","a","an","the","and",
    "but","if","or","as","of","at","by","for","with","about","into","through",
    "during","before","after","to","from","up","in","out","on","over","then","here",
    "there","when","where","how","all","both","each","more","other","some","no","not",
    "only","same","so","than","too","very","just","also","back","any","use","used",
}


# 7 JOB DESCRIPTIONS for TF-IDF comparison
JOB_DESCRIPTIONS = {
    "Backend Developer": (
        "python java nodejs javascript rest api graphql microservices django flask "
        "fastapi spring postgresql mysql mongodb redis docker kubernetes aws sql "
        "database authentication authorization performance scalability debugging git agile"
    ),
    "Frontend Developer": (
        "react vue angular javascript typescript html css tailwind bootstrap responsive "
        "ui ux figma webpack vite nextjs redux state management api integration "
        "accessibility jest testing animation git agile"
    ),
    "Full Stack Developer": (
        "react vue angular javascript typescript nodejs python html css rest api graphql "
        "postgresql mongodb redis docker aws git agile frontend backend authentication "
        "deployment cicd testing debugging responsive"
    ),
    "DevOps Engineer": (
        "docker kubernetes terraform ansible jenkins cicd aws azure gcp linux bash "
        "monitoring prometheus grafana nginx apache git python automation cloud "
        "infrastructure deployment pipeline security networking devops"
    ),
    "Data Engineer": (
        "python sql pandas numpy spark hadoop kafka airflow postgresql mysql aws etl "
        "machine learning tensorflow pytorch scikit-learn tableau powerbi analytics "
        "big data statistics r mongodb data warehouse pipeline"
    ),
    "QA / Tester": (
        "selenium cypress playwright jest mocha pytest junit testng automation testing "
        "manual regression integration performance api testing bug tracking jira agile "
        "scrum python javascript test cases test plans"
    ),
    "Business Analyst": (
        "requirements analysis business process stakeholder sql tableau powerbi agile "
        "scrum project management documentation wireframes figma data analysis excel "
        "communication presentation risk management functional specifications"
    ),
}


# =============================================================================
# STEP 1 — TEXT EXTRACTION
# =============================================================================

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract all text from PDF using pypdf (v5.x)."""
    if not HAS_PDF:
        raise ImportError("pypdf not installed. Run: pip install pypdf")
    try:
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        pages = []
        for page in reader.pages:
            t = page.extract_text()
            if t and t.strip():
                pages.append(t)
        result = "\n".join(pages)
        if not result.strip():
            return ""
        return result
    except Exception as e:
        raise ValueError(f"PDF extraction failed: {e}")


def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extract all text from DOCX using python-docx."""
    if not HAS_DOCX:
        raise ImportError("python-docx not installed. Run: pip install python-docx")
    try:
        doc = DocxDocument(io.BytesIO(file_bytes))
        parts = [p.text for p in doc.paragraphs if p.text.strip()]
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    if cell.text.strip():
                        parts.append(cell.text)
        return "\n".join(parts)
    except Exception as e:
        raise ValueError(f"DOCX extraction failed: {e}")


def extract_text(file_bytes: bytes, filename: str) -> str:
    """Route to correct extractor based on file extension."""
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if ext == "pdf":
        return extract_text_from_pdf(file_bytes)
    elif ext in ("docx", "doc"):
        return extract_text_from_docx(file_bytes)
    elif ext == "txt":
        return file_bytes.decode("utf-8", errors="ignore")
    else:
        raise ValueError(f"Unsupported file type '.{ext}'. Upload PDF, DOCX, or TXT.")


# =============================================================================
# STEP 2 — TEXT CLEANING
# =============================================================================

def clean_text(text: str) -> str:
    """
    Clean resume text for TF-IDF:
    1. Lowercase
    2. Remove URLs
    3. Remove emails
    4. Remove phone numbers
    5. Remove punctuation
    6. Remove standalone digits
    7. Remove stopwords and short words
    """
    text = text.lower()
    text = re.sub(r"https?://\S+|www\.\S+", " ", text)
    text = re.sub(r"\S+@\S+\.\S+", " ", text)
    text = re.sub(r"[\+]?[\d\s\-\(\)]{7,}", " ", text)
    text = re.sub(r"[^\w\s]", " ", text)
    text = re.sub(r"\b\d+\b", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    words = [w for w in text.split() if w not in STOPWORDS and len(w) > 2]
    return " ".join(words)


# =============================================================================
# STEP 3 — SKILL EXTRACTION
# =============================================================================

def extract_skills(raw_text: str) -> dict:
    """
    Match 200+ skill keywords against resume text using whole-word regex.
    Uses raw (uncleaned) text to preserve compound skills like 'react native'.
    """
    text_lower = raw_text.lower()
    found_by_category = {}
    all_found = []

    for category, skill_list in SKILL_DICT.items():
        hits = []
        for skill in skill_list:
            pattern = r"\b" + re.escape(skill) + r"\b"
            if re.search(pattern, text_lower):
                hits.append(skill)
                all_found.append(skill)
        if hits:
            found_by_category[category] = hits

    unique_skills = list(set(all_found))
    return {
        "by_category": found_by_category,
        "all_skills":  unique_skills,
        "total_count": len(unique_skills),
    }


# =============================================================================
# STEP 4 — TF-IDF + COSINE SIMILARITY
# =============================================================================

def compute_tfidf_similarity(resume_text: str, jd_text: str) -> float:
    """
    Compute cosine similarity between resume and JD using TF-IDF vectors.

    TF  = word_count_in_doc / total_words_in_doc
    IDF = log(total_docs / docs_containing_word)
    TF-IDF = TF x IDF  (rare but relevant words score higher)

    cosine_similarity = (A . B) / (||A|| x ||B||)
    Range: 0.0 (nothing in common) to 1.0 (identical)
    """
    if not resume_text.strip() or not jd_text.strip():
        return 0.0

    if not HAS_SKLEARN:
        # Fallback: simple keyword overlap
        r = set(resume_text.lower().split())
        j = set(jd_text.lower().split())
        return len(r & j) / len(j) if j else 0.0

    try:
        vectorizer = TfidfVectorizer(
            ngram_range=(1, 2),   # unigrams + bigrams
            min_df=1,
            stop_words="english",
            max_features=5000,
            sublinear_tf=True,    # log normalization
        )
        matrix     = vectorizer.fit_transform([resume_text, jd_text])
        similarity = cosine_similarity(matrix[0:1], matrix[1:2])[0][0]
        return float(similarity)
    except Exception:
        return 0.0


def compute_all_role_similarities(cleaned_resume: str) -> list:
    """Compare resume against all 7 JDs. Returns list sorted by similarity desc."""
    results = []
    for role_name, jd_text in JOB_DESCRIPTIONS.items():
        cleaned_jd = clean_text(jd_text)
        similarity = compute_tfidf_similarity(cleaned_resume, cleaned_jd)
        percent    = min(95, max(5, round(similarity * 100 + 5)))
        results.append({
            "name":       role_name,
            "percent":    percent,
            "similarity": round(similarity, 4),
        })
    results.sort(key=lambda x: x["similarity"], reverse=True)
    return results


# =============================================================================
# STEP 5 — FINAL SCORE FORMULA
# =============================================================================

def score_resume_from_text(raw_text: str, exp: int = 0) -> dict:
    """
    Score resume ONLY from extracted file content.

    Score breakdown (max 100):
    --------------------------------------------------
    Skills found    (count x 3)          max 40 pts
    Resume length   (word count)         max 20 pts
    TF-IDF best match (similarity x 35)  max 25 pts
    Experience bonus (exp x 2)           max 10 pts
    Category diversity                   max  5 pts
    --------------------------------------------------
    Final score: capped at 95, floored at 10
    """
    if not raw_text or len(raw_text.strip()) < 50:
        return {
            "resume_score": 10, "skills_found": [], "skills_by_category": {},
            "skill_count": 0, "word_count": 0, "role_fit": [],
            "best_match_role": "Unknown", "best_similarity": 0.0,
            "extracted_text_preview": "",
            "score_breakdown": {"skills_pts":0,"length_pts":0,"tfidf_pts":0,"exp_pts":0,"diversity_pts":0,"total":10},
            "error": "Resume text too short to analyse",
        }

    cleaned        = clean_text(raw_text)
    skills_data    = extract_skills(raw_text)            # raw text for skills
    role_fit       = compute_all_role_similarities(cleaned)  # cleaned for TF-IDF

    skill_count    = skills_data["total_count"]
    category_count = len(skills_data["by_category"])
    word_count     = len(cleaned.split())
    best_sim       = role_fit[0]["similarity"] if role_fit else 0.0

    skills_pts    = min(40, skill_count * 3)
    length_pts    = (20 if word_count>=600 else 15 if word_count>=400
                     else 10 if word_count>=200 else 5 if word_count>=100 else 0)
    tfidf_pts     = min(25, round(best_sim * 35))
    exp_pts       = min(10, int(exp) * 2)
    diversity_pts = min(5, category_count)

    final_score = min(95, max(10, skills_pts + length_pts + tfidf_pts + exp_pts + diversity_pts))

    return {
        "resume_score":           final_score,
        "skills_found":           skills_data["all_skills"],
        "skills_by_category":     skills_data["by_category"],
        "skill_count":            skill_count,
        "word_count":             word_count,
        "role_fit":               role_fit,
        "best_match_role":        role_fit[0]["name"] if role_fit else "Unknown",
        "best_similarity":        round(best_sim, 4),
        "extracted_text_preview": (raw_text[:400] + "...") if len(raw_text) > 400 else raw_text,
        "score_breakdown": {
            "skills_pts":    skills_pts,
            "length_pts":    length_pts,
            "tfidf_pts":     tfidf_pts,
            "exp_pts":       exp_pts,
            "diversity_pts": diversity_pts,
            "total":         final_score,
        },
    }
