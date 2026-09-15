-- University Student Records & Academic Database
CREATE TABLE IF NOT EXISTS departments (
  dept_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  faculty TEXT NOT NULL,
  budget INTEGER NOT NULL,
  building TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS instructors (
  instructor_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  salary INTEGER NOT NULL,
  dept_id INTEGER NOT NULL,
  FOREIGN KEY (dept_id) REFERENCES departments(dept_id)
);

CREATE TABLE IF NOT EXISTS courses (
  course_id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  credits INTEGER NOT NULL,
  dept_id INTEGER NOT NULL,
  instructor_id INTEGER,
  FOREIGN KEY (dept_id) REFERENCES departments(dept_id),
  FOREIGN KEY (instructor_id) REFERENCES instructors(instructor_id)
);

CREATE TABLE IF NOT EXISTS students (
  student_id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  matric_no TEXT NOT NULL UNIQUE,
  dept_id INTEGER NOT NULL,
  gpa REAL NOT NULL,
  enrollment_year INTEGER NOT NULL,
  FOREIGN KEY (dept_id) REFERENCES departments(dept_id)
);

CREATE TABLE IF NOT EXISTS enrollments (
  enrollment_id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  semester TEXT NOT NULL,
  score INTEGER NOT NULL,
  grade TEXT NOT NULL,
  status TEXT NOT NULL,
  FOREIGN KEY (student_id) REFERENCES students(student_id),
  FOREIGN KEY (course_id) REFERENCES courses(course_id)
);

-- Seed Data: Departments
INSERT INTO departments (name, faculty, budget, building) VALUES
  ('Business Information Technology', 'Faculty of Management & Tech', 85000000, 'Tech Hub A'),
  ('Computer Science', 'Faculty of Pure & Applied Sciences', 120000000, 'Science Complex'),
  ('Electrical & Solar Engineering', 'Faculty of Engineering', 150000000, 'Innovation Centre'),
  ('Economics & Finance', 'Faculty of Social Sciences', 70000000, 'Business Tower');

-- Seed Data: Instructors
INSERT INTO instructors (name, email, title, salary, dept_id) VALUES
  ('Prof. Olatunji Adeleke', 'o.adeleke@university.edu.ng', 'Professor', 1850000, 1),
  ('Dr. Fatima Bello', 'f.bello@university.edu.ng', 'Associate Professor', 1450000, 2),
  ('Engr. Emmanuel Okon', 'e.okon@university.edu.ng', 'Senior Lecturer', 1200000, 3),
  ('Dr. Ngozi Eze', 'n.eze@university.edu.ng', 'Senior Lecturer', 1300000, 4);

-- Seed Data: Courses
INSERT INTO courses (code, title, credits, dept_id, instructor_id) VALUES
  ('BIT301', 'Database Systems & SQL Analytics', 3, 1, 1),
  ('BIT305', 'Enterprise Systems & ERP', 3, 1, 1),
  ('CSC201', 'Data Structures & Algorithms', 4, 2, 2),
  ('CSC304', 'Cloud Computing & Distributed Systems', 3, 2, 2),
  ('ENG401', 'Solar Energy & Photovoltaic Power Systems', 4, 3, 3),
  ('ECO202', 'Managerial Microeconomics & Analytics', 3, 4, 4);

-- Seed Data: Students
INSERT INTO students (full_name, email, matric_no, dept_id, gpa, enrollment_year) VALUES
  ('Ayoola Damisile', 'ayoola.damisile@student.edu.ng', 'BIT/2023/0041', 1, 4.88, 2023),
  ('Chinedu Okafor', 'chinedu.okafor@student.edu.ng', 'BIT/2023/0088', 1, 4.25, 2023),
  ('Zainab Danjuma', 'zainab.danjuma@student.edu.ng', 'CSC/2023/0112', 2, 4.65, 2023),
  ('Tunde Bakare', 'tunde.bakare@student.edu.ng', 'CSC/2023/0095', 2, 3.45, 2023),
  ('Blessing Adeyemi', 'blessing.adeyemi@student.edu.ng', 'ENG/2022/0034', 3, 4.75, 2022),
  ('Kelechi Nnamdi', 'kelechi.nnamdi@student.edu.ng', 'ECO/2023/0201', 4, 3.85, 2023);

-- Seed Data: Enrollments
INSERT INTO enrollments (student_id, course_id, semester, score, grade, status) VALUES
  (1, 1, 'First Semester 2025/2026', 94, 'A', 'Passed'),
  (1, 2, 'First Semester 2025/2026', 91, 'A', 'Passed'),
  (1, 5, 'First Semester 2025/2026', 96, 'A', 'Passed'),
  (2, 1, 'First Semester 2025/2026', 82, 'A', 'Passed'),
  (2, 2, 'First Semester 2025/2026', 74, 'B', 'Passed'),
  (3, 3, 'First Semester 2025/2026', 89, 'A', 'Passed'),
  (3, 4, 'First Semester 2025/2026', 92, 'A', 'Passed'),
  (4, 3, 'First Semester 2025/2026', 58, 'C', 'Passed'),
  (4, 4, 'First Semester 2025/2026', 45, 'E', 'Passed'),
  (5, 5, 'First Semester 2025/2026', 95, 'A', 'Passed'),
  (6, 6, 'First Semester 2025/2026', 78, 'B', 'Passed');
