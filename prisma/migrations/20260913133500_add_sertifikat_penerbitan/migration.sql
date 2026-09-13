CREATE TABLE `sertifikat_penerbitan` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `token` VARCHAR(64) NOT NULL,
  `mahasiswa_id` BIGINT NOT NULL,
  `snapshot` JSON NOT NULL,
  `diterbitkan_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `dicabut_at` DATETIME(3) NULL,
  UNIQUE INDEX `sertifikat_penerbitan_token_key`(`token`),
  INDEX `sertifikat_penerbitan_mahasiswa_id_idx`(`mahasiswa_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `sertifikat_penerbitan_mahasiswa_id_fkey`
    FOREIGN KEY (`mahasiswa_id`) REFERENCES `mahasiswa`(`user_id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
