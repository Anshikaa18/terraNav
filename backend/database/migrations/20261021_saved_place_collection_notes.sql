-- Adds persistent saved-place collections and notes for existing installations.
ALTER TABLE `saved_places`
  ADD COLUMN `collection_name` VARCHAR(100) NOT NULL DEFAULT 'Favorites',
  ADD COLUMN `notes` TEXT NULL;

ALTER TABLE `route_history`
  MODIFY COLUMN `transport_mode` ENUM('car', 'motorcycle', 'bicycle', 'pedestrian') NOT NULL DEFAULT 'car';
