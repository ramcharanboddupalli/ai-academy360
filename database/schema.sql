CREATE DATABASE IF NOT EXISTS ai_academy360 CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE ai_academy360;

CREATE TABLE IF NOT EXISTS users (
	id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	email VARCHAR(254) NOT NULL,
	password_hash VARCHAR(255) NOT NULL,
	role ENUM('ADMIN', 'STUDENT') NOT NULL,
	is_active BOOLEAN NOT NULL DEFAULT TRUE,
	created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	UNIQUE KEY uq_users_email (email),
	KEY idx_users_role_active (role, is_active)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS courses (
	id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	code VARCHAR(50) NOT NULL,
	title VARCHAR(150) NOT NULL,
	description TEXT NULL,
	is_active BOOLEAN NOT NULL DEFAULT TRUE,
	created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	UNIQUE KEY uq_courses_code (code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS departments (
	id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	name VARCHAR(150) NOT NULL,
	description TEXT NULL,
	created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	UNIQUE KEY uq_departments_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS admins (
	id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	user_id BIGINT UNSIGNED NOT NULL,
	full_name VARCHAR(200) NOT NULL,
	email VARCHAR(254) NOT NULL,
	created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	UNIQUE KEY uq_admins_user_id (user_id),
	UNIQUE KEY uq_admins_email (email),
	CONSTRAINT fk_admins_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS students (
	id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	user_id BIGINT UNSIGNED NOT NULL,
	student_id VARCHAR(16) NOT NULL,
	full_name VARCHAR(200) NOT NULL,
	email VARCHAR(254) NOT NULL,
	phone VARCHAR(40) NOT NULL,
	course_id BIGINT UNSIGNED NOT NULL,
	batch VARCHAR(80) NOT NULL,
	join_date DATE NOT NULL,
	status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
	created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	UNIQUE KEY uq_students_user_id (user_id),
	UNIQUE KEY uq_students_student_id (student_id),
	UNIQUE KEY uq_students_email (email),
	KEY idx_students_course_status (course_id, status),
	CONSTRAINT fk_students_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
	CONSTRAINT fk_students_course FOREIGN KEY (course_id) REFERENCES courses(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS enrollments (
	id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	student_id BIGINT UNSIGNED NOT NULL,
	course_id BIGINT UNSIGNED NOT NULL,
	batch VARCHAR(80) NOT NULL,
	enrolled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	status ENUM('active', 'completed', 'dropped') NOT NULL DEFAULT 'active',
	PRIMARY KEY (id),
	UNIQUE KEY uq_enrollments_student_course (student_id, course_id),
	KEY idx_enrollments_course_status (course_id, status),
	CONSTRAINT fk_enrollments_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
	CONSTRAINT fk_enrollments_course FOREIGN KEY (course_id) REFERENCES courses(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tickets (
	id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	student_id BIGINT UNSIGNED NOT NULL,
	title VARCHAR(255) NOT NULL,
	description TEXT NOT NULL,
	category VARCHAR(100) NULL,
	priority ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
	status ENUM('open', 'in_progress', 'pending', 'resolved', 'closed') NOT NULL DEFAULT 'open',
	assigned_to BIGINT UNSIGNED NULL,
	department_id BIGINT UNSIGNED NULL,
	source VARCHAR(40) NOT NULL DEFAULT 'student_support',
	created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	KEY idx_tickets_student_status (student_id, status),
	CONSTRAINT fk_tickets_student FOREIGN KEY (student_id) REFERENCES students(id),
	CONSTRAINT fk_tickets_admin FOREIGN KEY (assigned_to) REFERENCES admins(id) ON DELETE SET NULL,
	CONSTRAINT fk_tickets_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ticket_messages (
	id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	ticket_id BIGINT UNSIGNED NOT NULL,
	sender_id BIGINT UNSIGNED NOT NULL,
	message TEXT NOT NULL,
	created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	KEY idx_ticket_messages_ticket_created (ticket_id, created_at),
	CONSTRAINT fk_ticket_messages_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
	CONSTRAINT fk_ticket_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ticket_assignments (
	id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	ticket_id BIGINT UNSIGNED NOT NULL,
	assigned_to BIGINT UNSIGNED NOT NULL,
	assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	KEY idx_ticket_assignments_ticket (ticket_id),
	CONSTRAINT fk_ticket_assignments_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
	CONSTRAINT fk_ticket_assignments_admin FOREIGN KEY (assigned_to) REFERENCES admins(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ticket_status_history (
	id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	ticket_id BIGINT UNSIGNED NOT NULL,
	previous_status VARCHAR(50) NULL,
	new_status VARCHAR(50) NOT NULL,
	changed_by BIGINT UNSIGNED NULL,
	created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	KEY idx_ticket_status_history_ticket (ticket_id, created_at),
	CONSTRAINT fk_ticket_status_history_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
	CONSTRAINT fk_ticket_status_history_user FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ai_analysis (
	id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	ticket_id BIGINT UNSIGNED NOT NULL,
	intent VARCHAR(100) NULL,
	category VARCHAR(100) NULL,
	priority VARCHAR(50) NULL,
	department VARCHAR(100) NULL,
	sentiment VARCHAR(50) NULL,
	summary TEXT NULL,
	suggested_response TEXT NULL,
	recommended_action TEXT NULL,
	confidence DECIMAL(4,3) NULL,
	created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	KEY idx_ai_analysis_ticket (ticket_id),
	CONSTRAINT fk_ai_analysis_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ai_management_insights (
	id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	generated_by BIGINT UNSIGNED NOT NULL,
	period ENUM('last_7_days', 'last_30_days', 'last_90_days') NOT NULL,
	provider VARCHAR(40) NOT NULL,
	model VARCHAR(120) NOT NULL,
	input_snapshot JSON NOT NULL,
	summary TEXT NOT NULL,
	key_issues JSON NOT NULL,
	risk_areas JSON NOT NULL,
	recommendations JSON NOT NULL,
	priority_action TEXT NOT NULL,
	created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	KEY idx_ai_management_insights_created (created_at),
	KEY idx_ai_management_insights_period (period, created_at),
	CONSTRAINT fk_ai_management_insights_admin FOREIGN KEY (generated_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS complaint_feedback (
	id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	ticket_id BIGINT UNSIGNED NOT NULL,
	rating TINYINT UNSIGNED NULL,
	comment TEXT NULL,
	created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	UNIQUE KEY uq_complaint_feedback_ticket (ticket_id),
	CONSTRAINT chk_complaint_feedback_rating CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
	CONSTRAINT fk_complaint_feedback_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
	id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	user_id BIGINT UNSIGNED NOT NULL,
	title VARCHAR(255) NOT NULL,
	message TEXT NOT NULL,
	is_read BOOLEAN NOT NULL DEFAULT FALSE,
	created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	KEY idx_notifications_user_read (user_id, is_read, created_at),
	CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS student_id_sequences (
	academic_year SMALLINT UNSIGNED NOT NULL,
	last_sequence BIGINT UNSIGNED NOT NULL DEFAULT 0,
	PRIMARY KEY (academic_year)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS token_revocations (
	token_id CHAR(36) NOT NULL,
	expires_at TIMESTAMP NOT NULL,
	revoked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (token_id),
	KEY idx_token_revocations_expiry (expires_at)
) ENGINE=InnoDB;

INSERT INTO courses (code, title) VALUES
	('DATA-ANALYTICS', 'Data Analytics'),
	('DATA-SCIENCE', 'Data Science'),
	('CYBERSECURITY', 'Cybersecurity'),
	('BUSINESS-ANALYTICS', 'Business Analytics'),
	('AI-PRODUCT', 'AI Product Management')
ON DUPLICATE KEY UPDATE title = VALUES(title), is_active = TRUE;

INSERT IGNORE INTO departments (name, description) VALUES
	('student_support', 'General student support requests'),
	('academic_advising', 'Course enrollment and academic advising'),
	('finance', 'Payments and billing support'),
	('it_support', 'Technical support for academy systems'),
	('admin_ops', 'Administrative operations'),
	('faculty', 'Faculty and instructor support');
