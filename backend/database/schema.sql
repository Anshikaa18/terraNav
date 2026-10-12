-- ==============================================================================
-- TerraNav AI — Relational Database Schema (MySQL / XAMPP)
-- Member 3: Backend Integration, Microservices & Data Layer
-- Target Database: terranav_db
-- ==============================================================================

-- Create Database
CREATE DATABASE IF NOT EXISTS `terranav_db` 
  DEFAULT CHARACTER SET utf8mb4 
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `terranav_db`;

-- Drop existing tables in reverse dependency order if recreating
DROP TABLE IF EXISTS `incidents`;
DROP TABLE IF EXISTS `route_history`;
DROP TABLE IF EXISTS `saved_places`;
DROP TABLE IF EXISTS `users`;

-- ------------------------------------------------------------------------------
-- 1. Table: users
-- Stores registered user profiles with hashed credentials
-- ------------------------------------------------------------------------------
CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL,
  `email` VARCHAR(100) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Constraints & Indexes
  CONSTRAINT `uq_users_username` UNIQUE (`username`),
  CONSTRAINT `uq_users_email` UNIQUE (`email`),
  INDEX `idx_users_email` (`email`),
  INDEX `idx_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 2. Table: saved_places
-- Stores user-bookmarked origins, destinations, and favorite locations
-- ------------------------------------------------------------------------------
CREATE TABLE `saved_places` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `latitude` DECIMAL(10, 8) NOT NULL,
  `longitude` DECIMAL(11, 8) NOT NULL,
  `address` VARCHAR(255) NULL,
  `category` VARCHAR(50) DEFAULT 'favorite',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Foreign Keys & Indexes
  CONSTRAINT `fk_saved_places_user` 
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) 
    ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX `idx_saved_places_user` (`user_id`),
  INDEX `idx_saved_places_coords` (`latitude`, `longitude`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 3. Table: route_history
-- Stores past trip logs, dynamic routes taken, and duration savings
-- ------------------------------------------------------------------------------
CREATE TABLE `route_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `origin_lat` DECIMAL(10, 8) NOT NULL,
  `origin_lng` DECIMAL(11, 8) NOT NULL,
  `origin_name` VARCHAR(255) NULL,
  `dest_lat` DECIMAL(10, 8) NOT NULL,
  `dest_lng` DECIMAL(11, 8) NOT NULL,
  `dest_name` VARCHAR(255) NULL,
  `transport_mode` ENUM('car', 'motorcycle', 'pedestrian') NOT NULL DEFAULT 'car',
  `total_distance_meters` INT NOT NULL,
  `total_duration_seconds` INT NOT NULL,
  `traditional_duration_seconds` INT NOT NULL,
  `time_saved_seconds` INT NOT NULL DEFAULT 0,
  `simulated_incident` JSON NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Foreign Keys & Indexes
  CONSTRAINT `fk_route_history_user` 
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) 
    ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX `idx_route_history_user` (`user_id`),
  INDEX `idx_route_history_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 4. Table: incidents
-- Stores active road incidents and ChunkFlow simulated incidents
-- ------------------------------------------------------------------------------
CREATE TABLE `incidents` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `chunk_id` VARCHAR(50) NOT NULL,
  `incident_type` ENUM('accident', 'roadblock', 'construction', 'flooding', 'heavy_traffic', 'other') NOT NULL,
  `latitude` DECIMAL(10, 8) NULL,
  `longitude` DECIMAL(11, 8) NULL,
  `description` TEXT NULL,
  `severity` ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
  `status` ENUM('active', 'cleared', 'expired') DEFAULT 'active',
  `reported_by` INT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `cleared_at` TIMESTAMP NULL,

  -- Foreign Keys & Indexes
  CONSTRAINT `fk_incidents_reporter` 
    FOREIGN KEY (`reported_by`) REFERENCES `users` (`id`) 
    ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_incidents_chunk` (`chunk_id`),
  INDEX `idx_incidents_status` (`status`),
  INDEX `idx_incidents_type` (`incident_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Seed Sample Data for Testing & Verification
-- ------------------------------------------------------------------------------
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`) VALUES
(1, 'demo_user', 'demo@terranav.ai', '$2a$10$w099WjP8EwE9o2rYy0x7reK5O51BszlEa8h4kU6b2f7oM71M88lCq'); -- Password: Password123!

INSERT INTO `saved_places` (`user_id`, `name`, `latitude`, `longitude`, `address`, `category`) VALUES
(1, 'MG Road Station', 12.9756, 77.6066, 'MG Road, Bengaluru, Karnataka 560001', 'work'),
(1, 'Koramangala 5th Block', 12.9352, 77.6245, 'Koramangala, Bengaluru, Karnataka 560095', 'home'),
(1, 'Indiranagar 100ft Road', 12.9784, 77.6408, '100ft Road, Indiranagar, Bengaluru', 'favorite');

INSERT INTO `incidents` (`chunk_id`, `incident_type`, `latitude`, `longitude`, `description`, `severity`, `status`, `reported_by`) VALUES
('CHUNK_104', 'accident', 12.9550, 77.6050, 'Multi-vehicle collision blocking right lane', 'high', 'active', 1),
('CHUNK_202', 'construction', 12.9420, 77.6180, 'Flyover resurfacing work', 'medium', 'active', 1);
