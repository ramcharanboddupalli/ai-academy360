CREATE TABLE IF NOT EXISTS classes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  instructor VARCHAR(200) NULL,
  location VARCHAR(200) NULL,
  status ENUM('scheduled', 'live', 'completed', 'cancelled') NOT NULL DEFAULT 'scheduled',
  recording_url VARCHAR(2048) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_classes_course_start (course_id, starts_at, status),
  CONSTRAINT fk_classes_course FOREIGN KEY (course_id) REFERENCES courses(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS attendance (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  class_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  status ENUM('present', 'absent', 'late', 'excused') NOT NULL,
  marked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_attendance_class_student (class_id, student_id),
  KEY idx_attendance_student_status (student_id, status),
  CONSTRAINT fk_attendance_class FOREIGN KEY (class_id) REFERENCES classes(id),
  CONSTRAINT fk_attendance_student FOREIGN KEY (student_id) REFERENCES students(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS course_progress (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  enrollment_id BIGINT UNSIGNED NOT NULL,
  progress_percent DECIMAL(5,2) NOT NULL,
  current_topic VARCHAR(255) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_course_progress_enrollment (enrollment_id),
  CONSTRAINT chk_course_progress_percent CHECK (progress_percent BETWEEN 0 AND 100),
  CONSTRAINT fk_course_progress_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS course_topics (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  position INT UNSIGNED NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id),
  KEY idx_course_topics_course_position (course_id, position),
  CONSTRAINT fk_course_topics_course FOREIGN KEY (course_id) REFERENCES courses(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS student_topic_completions (
  student_id BIGINT UNSIGNED NOT NULL,
  topic_id BIGINT UNSIGNED NOT NULL,
  completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (student_id, topic_id),
  CONSTRAINT fk_student_topic_completion_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_student_topic_completion_topic FOREIGN KEY (topic_id) REFERENCES course_topics(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS learning_tasks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id BIGINT UNSIGNED NOT NULL,
  course_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  due_at DATETIME NULL,
  status ENUM('pending', 'in_progress', 'completed') NOT NULL DEFAULT 'pending',
  completed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_learning_tasks_student_status_due (student_id, status, due_at),
  CONSTRAINT fk_learning_tasks_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_learning_tasks_course FOREIGN KEY (course_id) REFERENCES courses(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS resources (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  resource_type ENUM('note', 'pdf', 'video', 'link', 'assignment') NOT NULL,
  resource_url VARCHAR(2048) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_resources_course_active (course_id, is_active, created_at),
  CONSTRAINT fk_resources_course FOREIGN KEY (course_id) REFERENCES courses(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id BIGINT UNSIGNED NOT NULL,
  enrollment_id BIGINT UNSIGNED NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  payment_date DATETIME NULL,
  status ENUM('pending', 'paid', 'failed', 'refunded') NOT NULL,
  reference_id VARCHAR(150) NULL,
  receipt_url VARCHAR(2048) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payments_student_date (student_id, payment_date),
  CONSTRAINT fk_payments_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_payments_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS certificates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id BIGINT UNSIGNED NOT NULL,
  course_id BIGINT UNSIGNED NOT NULL,
  certificate_id VARCHAR(120) NOT NULL,
  status ENUM('pending', 'issued', 'revoked') NOT NULL DEFAULT 'pending',
  issued_at DATETIME NULL,
  file_url VARCHAR(2048) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_certificates_certificate_id (certificate_id),
  KEY idx_certificates_student_status (student_id, status),
  CONSTRAINT fk_certificates_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_certificates_course FOREIGN KEY (course_id) REFERENCES courses(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS internships (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  organization VARCHAR(255) NOT NULL,
  description TEXT NULL,
  duration VARCHAR(100) NULL,
  requirements JSON NULL,
  skill_requirements JSON NULL,
  application_deadline DATETIME NULL,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_internships_published_deadline (is_published, application_deadline)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS internship_applications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  internship_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  status ENUM('applied', 'in_progress', 'completed', 'rejected', 'withdrawn') NOT NULL DEFAULT 'applied',
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_internship_applications_internship_student (internship_id, student_id),
  KEY idx_internship_applications_student_status (student_id, status),
  CONSTRAINT fk_internship_applications_internship FOREIGN KEY (internship_id) REFERENCES internships(id),
  CONSTRAINT fk_internship_applications_student FOREIGN KEY (student_id) REFERENCES students(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS announcements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  category ENUM('general', 'course', 'schedule', 'payment', 'internship', 'important') NOT NULL DEFAULT 'general',
  target_type ENUM('all', 'course', 'student') NOT NULL DEFAULT 'all',
  target_course_id BIGINT UNSIGNED NULL,
  target_student_id BIGINT UNSIGNED NULL,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_announcements_published (is_published, published_at),
  KEY idx_announcements_target_course (target_type, target_course_id),
  KEY idx_announcements_target_student (target_type, target_student_id),
  CONSTRAINT fk_announcements_course FOREIGN KEY (target_course_id) REFERENCES courses(id),
  CONSTRAINT fk_announcements_student FOREIGN KEY (target_student_id) REFERENCES students(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS announcement_reads (
  announcement_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (announcement_id, student_id),
  CONSTRAINT fk_announcement_reads_announcement FOREIGN KEY (announcement_id) REFERENCES announcements(id),
  CONSTRAINT fk_announcement_reads_student FOREIGN KEY (student_id) REFERENCES students(id)
) ENGINE=InnoDB;