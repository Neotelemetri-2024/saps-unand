import { Request, Response } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import { JWT_SECRET } from "../middlewares/auth.middleware";
import { resolveKurikulumMahasiswa, resolveKurikulumIdForAngkatan } from "../services/kurikulumResolver.service";
import { z } from "zod";

// ==================== VALIDASI ====================
const loginSchema = z.object({
  email: z.string({ message: "Email wajib diisi" }).email("Format email tidak valid"),
  password: z.string({ message: "Password wajib diisi" }).min(1, "Password wajib diisi"),
});

const registerSchema = z.object({
  nama: z.string({ message: "Nama wajib diisi" }).min(2, "Nama minimal 2 karakter"),
  email: z.string({ message: "Email wajib diisi" }).email("Format email tidak valid"),
  password: z.string({ message: "Password wajib diisi" }).min(8, "Password minimal 8 karakter"),
});

// ==================== LOGIN ====================

/**
 * POST /api/auth/login
 *
 * Menerima email + password, memverifikasi, dan mengembalikan JWT token.
 * Token berisi: id, peran, jabatan (jika staff), dan nama.
 *
 * Alur penentuan role di token:
 * - Jika user.peran === 'staff', kita query tabel Staff untuk mendapatkan jabatan
 *   (admin_ditmawa, pimpinan_ditmawa, admin_fakultas, pimpinan_fakultas)
 * - Jika user.peran === 'operator_org', kita query tabel OrganisasiOperator
 *   untuk mendapatkan organisasiId
 * - Jika user.peran === 'mahasiswa' atau 'dosen', cukup simpan peran saja
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = loginSchema.parse(req.body);

    // 1. Cari user berdasarkan email
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Email atau password salah.",
      });
      return;
    }

    // 2. Cek apakah akun aktif
    if (!user.aktif) {
      res.status(403).json({
        success: false,
        message: "Akun Anda dinonaktifkan. Hubungi admin.",
      });
      return;
    }

    // 3. Verifikasi password
    const isPasswordValid = await bcrypt.compare(
      data.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: "Password salah. Silakan coba lagi.",
      });
      return;
    }

    // 4. Bangun JWT payload berdasarkan role
    const tokenPayload: Record<string, any> = {
      id: user.id.toString(),
      peran: user.peran,
      nama: user.nama,
    };

    let staffJabatan: string | null = null;
    let tipeOrganisasi: string | null = null;
    let role: string = user.peran;

    // Jika staff, ambil jabatan spesifik
    if (user.peran === "staff") {
      const staff = await prisma.staff.findUnique({
        where: { userId: user.id },
        select: { jabatan: true },
      });
      if (staff) {
        staffJabatan = staff.jabatan;
        tokenPayload.jabatan = staff.jabatan;
        role = staff.jabatan;
      }
    }

    // Jika operator_org, ambil organisasi terkait
    if (user.peran === "operator_org") {
      const operator = await prisma.organisasiOperator.findUnique({
        where: { userId: user.id },
        include: { organisasi: { select: { id: true, nama: true, tipe: true } } },
      });
      if (operator) {
        tokenPayload.organisasiId = operator.organisasiId;
        tokenPayload.namaOrganisasi = operator.organisasi.nama;
        tipeOrganisasi = operator.organisasi.tipe || null;
        tokenPayload.tipeOrganisasi = tipeOrganisasi;
        const tipeLower = (tipeOrganisasi || "").toLowerCase();
        if (["ukmf", "fakultas", "ukmf_org"].includes(tipeLower)) {
          role = "operator_ukmf";
        } else {
          role = "operator_ukm";
        }
      }
    }

    // 5. Generate JWT token (berlaku 24 jam)
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "24h" });

    res.json({
      success: true,
      message: "Login berhasil!",
      data: {
        token,
        user: {
          id: user.id.toString(),
          nama: user.nama,
          email: user.email,
          peran: user.peran,
          jabatan: staffJabatan,
          role,
          organisasiId: tokenPayload.organisasiId || null,
          namaOrganisasi: tokenPayload.namaOrganisasi || null,
          tipeOrganisasi,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMsg = error.issues.map((i) => i.message).join(", ") || "Validasi gagal";
      res.status(400).json({
        success: false,
        message: errorMsg,
        errors: error.issues,
      });
    } else {
      console.error(error);
      res.status(500).json({
        success: false,
        message: "Terjadi kesalahan pada server",
      });
    }
  }
};

// ==================== GET PROFILE (ME) ====================

/**
 * GET /api/auth/me
 *
 * Mengembalikan profil lengkap user yang sedang login.
 * Membutuhkan token JWT yang valid.
 */
export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const userId = BigInt(req.user.id);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nama: true,
        email: true,
        peran: true,
        aktif: true,
        nomorTelepon: true,
        alamat: true,
        createdAt: true,
        mahasiswa: {
          select: {
            nim: true,
            angkatan: true,
            prodiId: true,
            kurikulumId: true,
            kurikulum: { select: { id: true, nama: true } },
            prodi: {
              select: {
                id: true,
                nama: true,
                fakultasId: true,
                fakultas: { select: { id: true, nama: true } },
              },
            },
            dosenPA: { select: { user: { select: { nama: true } } } },
          },
        },
        dosen: {
          select: {
            nidn: true,
            fakultas: { select: { id: true, nama: true } },
          },
        },
        staff: {
          select: {
            jabatan: true,
            namaJabatan: true,
            nip: true,
            fakultas: { select: { id: true, nama: true } },
          },
        },
        organisasiOperator: {
          select: {
            organisasi: { select: { id: true, nama: true, tipe: true } },
          },
        },
      },
    });

    if (!user) {
      // Fallback aman untuk user SSO baru jika query profil belum menemukan record internal
      res.json({
        success: true,
        data: {
          id: req.user.id,
          nama: req.user.nama || 'Pengguna',
          email: (req.user as any).email || '',
          peran: req.user.peran,
          aktif: true,
        },
      });
      return;
    }

    let userResponse: any = user;
    if (user.peran === "mahasiswa" && user.id && user.mahasiswa) {
      if (user.mahasiswa.kurikulum) {
        userResponse = {
          ...user,
          mahasiswa: {
            ...user.mahasiswa,
            kurikulumId: user.mahasiswa.kurikulum.id,
            kurikulumNama: user.mahasiswa.kurikulum.nama,
          },
        };
      } else {
        try {
          const kur = await resolveKurikulumMahasiswa(user.id, prisma, {
            includeStructure: false,
            requireActive: false,
          });
          if (kur) {
            userResponse = {
              ...user,
              mahasiswa: {
                ...user.mahasiswa,
                kurikulumId: kur.id,
                kurikulumNama: kur.nama,
                kurikulum: { id: kur.id, nama: kur.nama },
              },
            };
          }
        } catch (err) {
          // Abaikan jika tidak dapat di-resolve agar tidak menimbulkan error 500
        }
      }
    }

    res.json({ success: true, data: userResponse });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan pada server" });
  }
};

// ==================== HASH PASSWORD HELPER ====================

/**
 * Fungsi bantuan: Hash password menggunakan bcrypt.
 * Digunakan saat membuat user baru atau reset password.
 */
export const hashPassword = async (plainPassword: string): Promise<string> => {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plainPassword, salt);
};

// ==================== UPDATE PROFIL ====================

const updateProfilSchema = z.object({
  nama: z.string().min(2, "Nama minimal 2 karakter").optional(),
  email: z
    .union([z.string().email("Format email tidak valid"), z.null()])
    .optional(),
  nomorTelepon: z
    .coerce.string()
    .max(30, "Nomor telepon maksimal 30 karakter")
    .nullable()
    .optional(),
  alamat: z
    .string()
    .max(255, "Alamat maksimal 255 karakter")
    .nullable()
    .optional(),
  prodiId: z.coerce.number().int("ID Program Studi harus bilangan bulat").positive("ID Program Studi tidak valid").optional(),
});

/**
 * PUT /api/auth/profil
 *
 * Memperbarui profil user yang sedang login:
 * - nama, email, nomorTelepon, alamat (tabel users)
 * - prodiId (tabel mahasiswa, hanya peran mahasiswa)
 *
 * Membutuhkan token JWT yang valid.
 */
export const updateProfil = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const data = updateProfilSchema.parse(req.body);

    if (Object.keys(data).length === 0) {
      res
        .status(400)
        .json({ success: false, message: "Tidak ada data yang dikirim." });
      return;
    }

    const userId = BigInt(req.user.id);

    // Jika email diubah, pastikan tidak dipakai user lain
    if (data.email) {
      const existing = await prisma.user.findFirst({
        where: { email: data.email, NOT: { id: userId } },
      });
      if (existing) {
        res.status(400).json({
          success: false,
          message: "Email sudah digunakan oleh akun lain.",
        });
        return;
      }
    }

    if (data.prodiId !== undefined) {
      const current = await prisma.user.findUnique({
        where: { id: userId },
        select: { peran: true, mahasiswa: { select: { userId: true } } },
      });
      if (current?.peran !== "mahasiswa" || !current.mahasiswa) {
        res.status(400).json({
          success: false,
          message: "Hanya mahasiswa yang dapat mengubah program studi.",
        });
        return;
      }
      const prodi = await prisma.programStudi.findUnique({
        where: { id: data.prodiId },
      });
      if (!prodi) {
        res.status(400).json({
          success: false,
          message: "Program studi tidak ditemukan.",
        });
        return;
      }
      await prisma.mahasiswa.update({
        where: { userId },
        data: { prodiId: data.prodiId },
      });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.nama !== undefined && { nama: data.nama }),
        ...(data.email ? { email: data.email } : {}),
        ...(data.nomorTelepon !== undefined && {
          nomorTelepon: data.nomorTelepon,
        }),
        ...(data.alamat !== undefined && { alamat: data.alamat }),
      },
      select: {
        id: true,
        nama: true,
        email: true,
        peran: true,
        nomorTelepon: true,
        alamat: true,
        mahasiswa: {
          select: {
            nim: true,
            prodiId: true,
            prodi: {
              select: {
                id: true,
                nama: true,
                fakultasId: true,
                fakultas: { select: { id: true, nama: true } },
              },
            },
          },
        },
      },
    });

    res.json({
      success: true,
      message: "Profil berhasil diperbarui.",
      data: {
        ...user,
        id: user.id.toString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMsg = error.issues.map((i) => i.message).join(", ") || "Validasi gagal";
      res.status(400).json({
        success: false,
        message: errorMsg,
        errors: error.issues,
      });
    } else {
      console.error(error);
      res.status(500).json({
        success: false,
        message: "Terjadi kesalahan pada server",
      });
    }
  }
};

// ==================== GANTI PASSWORD ====================

const gantiPasswordSchema = z
  .object({
    passwordLama: z.string({ message: "Password lama wajib diisi" }).min(1, "Password lama wajib diisi"),
    passwordBaru: z.string({ message: "Password baru wajib diisi" }).min(8, "Password baru minimal 8 karakter"),
    konfirmasiPassword: z.string({ message: "Konfirmasi password wajib diisi" }).min(1, "Konfirmasi password wajib diisi"),
  })
  .refine((d) => d.passwordBaru === d.konfirmasiPassword, {
    message: "Konfirmasi password tidak cocok.",
    path: ["konfirmasiPassword"],
  });

/**
 * PUT /api/auth/ganti-password
 *
 * Mengganti password user yang sedang login.
 * Password lama harus benar sebelum password baru disimpan.
 *
 * Membutuhkan token JWT yang valid.
 */
export const gantiPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const data = gantiPasswordSchema.parse(req.body);

    const userId = BigInt(req.user.id);
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      res.status(404).json({ success: false, message: "User tidak ditemukan" });
      return;
    }

    // Verifikasi password lama
    const isMatch = await bcrypt.compare(data.passwordLama, user.passwordHash);
    if (!isMatch) {
      res.status(400).json({ success: false, message: "Password lama salah." });
      return;
    }

    // Jangan mengubah password jika sama dengan yang lama
    const sameAsOld = await bcrypt.compare(
      data.passwordBaru,
      user.passwordHash,
    );
    if (sameAsOld) {
      res.status(400).json({
        success: false,
        message: "Password baru tidak boleh sama dengan password lama.",
      });
      return;
    }

    const passwordHash = await hashPassword(data.passwordBaru);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    res.json({ success: true, message: "Password berhasil diubah." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMsg = error.issues.map((i) => i.message).join(", ") || "Validasi gagal";
      res.status(400).json({
        success: false,
        message: errorMsg,
        errors: error.issues,
      });
    } else {
      console.error(error);
      res.status(500).json({
        success: false,
        message: "Terjadi kesalahan pada server",
      });
    }
  }
};

// ==================== UPDATE FCM TOKEN ====================

const fcmTokenSchema = z.object({
  fcmToken: z.string().min(1, "FCM Token wajib diisi"),
});

/**
 * PUT /api/auth/fcm-token
 *
 * Menyimpan/memperbarui FCM device token untuk push notification.
 * Dipanggil oleh Frontend setelah user login dan mendapatkan izin notifikasi browser.
 */
export const updateFcmToken = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const data = fcmTokenSchema.parse(req.body);
    const userId = BigInt(req.user.id);

    await prisma.user.update({
      where: { id: userId },
      data: { fcmToken: data.fcmToken },
    });

    res.json({ success: true, message: "FCM Token berhasil disimpan." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMsg = error.issues.map((i) => i.message).join(", ") || "Validasi gagal";
      res.status(400).json({
        success: false,
        message: errorMsg,
        errors: error.issues,
      });
    } else {
      console.error(error);
      res.status(500).json({
        success: false,
        message: "Terjadi kesalahan pada server",
      });
    }
  }
};

import * as oidc from 'openid-client';

// ==================== SSO UNAND (KEYCLOAK DTI) ====================

const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL || 'https://sso.unand.ac.id/auth';
const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || process.env.SSO_CLIENT_ID || 'saps-unand';
const KEYCLOAK_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET || process.env.SSO_CLIENT_SECRET || '7whZVUugIp7AEjMThqRuaApbCIjMjyns';
const KEYCLOAK_CALLBACK_URL = process.env.KEYCLOAK_CALLBACK_URL || process.env.SSO_REDIRECT_URI || 'https://api-studentconnect.unand.ac.id/api/auth/callback';
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://studentconnect.unand.ac.id').replace(/\/$/, '');
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'unand';

interface SsoTransactionRecord {
  codeVerifier: string;
  frontendUrl?: string;
  createdAt: number;
}
const ssoTransactions = new Map<string, SsoTransactionRecord>();

const cleanupSsoTransactions = () => {
  const now = Date.now();
  const maxAge = 10 * 60 * 1000; // 10 menit
  for (const [state, transaction] of ssoTransactions.entries()) {
    if (now - transaction.createdAt > maxAge) {
      ssoTransactions.delete(state);
    }
  }
};

const getKeycloakConfig = async () => {
  const issuerUrl = `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}`;
  return await oidc.discovery(new URL(issuerUrl), KEYCLOAK_CLIENT_ID, KEYCLOAK_CLIENT_SECRET);
};

/**
 * GET /api/auth/sso
 *
 * Memulai login SSO melalui Keycloak UNAND (DTI).
 * Menggunakan Authorization Code Flow + PKCE + state.
 */
export const ssoLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    cleanupSsoTransactions();
    const config = await getKeycloakConfig();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
    const state = oidc.randomState();

    const referer = req.headers.referer || req.headers.origin;
    let targetFrontend = FRONTEND_URL;
    if (typeof req.query.frontend === 'string' && req.query.frontend.trim()) {
      targetFrontend = req.query.frontend.trim().replace(/\/$/, '');
    } else if (referer && typeof referer === 'string') {
      try {
        const u = new URL(referer);
        targetFrontend = `${u.protocol}//${u.host}`;
      } catch {}
    }

    ssoTransactions.set(state, {
      codeVerifier,
      frontendUrl: targetFrontend,
      createdAt: Date.now(),
    });

    const authorizationUrl = oidc.buildAuthorizationUrl(config, {
      redirect_uri: KEYCLOAK_CALLBACK_URL,
      scope: 'openid profile email',
      response_type: 'code',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      prompt: 'login',
    });

    res.redirect(authorizationUrl.href);
  } catch (error) {
    console.error('SSO Login Error:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal terhubung ke SSO Universitas Andalas.',
    });
  }
};

/**
 * GET /api/auth/sso/mock
 * Endpoint khusus pengujian SSO di environment Local Development (Offline).
 */
export const ssoMockLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const role = (req.query.role || 'mahasiswa').toString().toLowerCase();
    const referer = req.headers.referer || req.headers.origin;
    let targetFrontend = FRONTEND_URL;
    if (typeof req.query.frontend === 'string' && req.query.frontend.trim()) {
      targetFrontend = req.query.frontend.trim().replace(/\/$/, '');
    } else if (referer && typeof referer === 'string') {
      try {
        const u = new URL(referer);
        targetFrontend = `${u.protocol}//${u.host}`;
      } catch {}
    } else {
      targetFrontend = 'http://localhost:5173';
    }

    let email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
    let nama = typeof req.query.nama === 'string' ? req.query.nama.trim() : '';
    let username = typeof req.query.nim === 'string' ? req.query.nim.trim() : '';

    if (role === 'dosen') {
      username = username || '198501012010121001';
      nama = nama || 'Dr. Dosen Teladan, M.Kom';
      email = email || `${username}@unand.ac.id`;
    } else {
      username = username || '2411522001';
      nama = nama || (username === '2411522001' ? 'Sheva Ramadhan' : `Mahasiswa (${username})`);
      email = email || `${username}@student.unand.ac.id`;
    }

    let peran: 'mahasiswa' | 'dosen' | 'staff' = role === 'dosen' ? 'dosen' : 'mahasiswa';

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          nama,
          email,
          passwordHash: await hashPassword(crypto.randomUUID()),
          peran: peran as any,
          aktif: true,
        },
      });
    } else if (!user.aktif) {
      await prisma.user.update({
        where: { id: user.id },
        data: { aktif: true },
      });
    }

    if (user.peran === 'mahasiswa') {
      const existingMhs = await prisma.mahasiswa.findUnique({
        where: { userId: user.id },
      });

      if (!existingMhs) {
        let nim = username;
        let angkatan = new Date().getFullYear();
        if (/^\d{2}/.test(nim)) {
          const prefixYear = parseInt(nim.substring(0, 2), 10);
          if (prefixYear >= 15 && prefixYear <= 40) {
            angkatan = 2000 + prefixYear;
          }
        }
        const defaultProdi = await prisma.programStudi.findFirst();
        const prodiId = defaultProdi?.id || 1;
        const kurikulumId = await resolveKurikulumIdForAngkatan(angkatan);

        await prisma.mahasiswa.create({
          data: {
            userId: user.id,
            nim,
            angkatan,
            prodiId,
            kurikulumId,
          },
        });
      }
    } else if (user.peran === 'dosen') {
      const existingDosen = await prisma.dosen.findUnique({
        where: { userId: user.id },
      });
      if (!existingDosen) {
        const defaultFakultas = await prisma.fakultas.findFirst();
        await prisma.dosen.create({
          data: {
            userId: user.id,
            nidn: username || `NIDN-${user.id}`,
            fakultasId: defaultFakultas?.id || 1,
          },
        });
      }
    }

    const tokenPayload: Record<string, any> = {
      id: user.id.toString(),
      peran: user.peran,
      nama: user.nama,
      email: user.email,
      nim: user.peran === 'mahasiswa' ? username : undefined,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });
    res.redirect(`${targetFrontend}/login?sso=success&token=${encodeURIComponent(token)}`);
  } catch (err: any) {
    console.error('[SSO Mock Error]', err);
    res.redirect(`http://localhost:5173/login?error=${encodeURIComponent('Gagal simulasi SSO: ' + (err?.message || 'Error'))}`);
  }
};

/**
 * GET /api/auth/callback
 *
 * Callback dari Keycloak setelah autentikasi berhasil.
 * 1. Validasi state & PKCE codeVerifier
 * 2. Tukar authorization code menjadi tokens via openid-client
 * 3. Ambil user claims (email, name, preferred_username)
 * 4. Menerapkan saran DTI: Gunakan Session SSO langsung tanpa penolakan database internal
 * 5. Terbitkan session token SAPS (JWT)
 * 6. Redirect ke Frontend dashboard
 */
export const ssoCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    cleanupSsoTransactions();
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    if (!state) {
      res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent('State SSO tidak ditemukan.')}`);
      return;
    }
    const transaction = ssoTransactions.get(state);
    if (!transaction) {
      res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent('Sesi login SSO tidak valid atau sudah kedaluwarsa.')}`);
      return;
    }
    ssoTransactions.delete(state);

    const clientFrontendUrl = transaction.frontendUrl || FRONTEND_URL;

    const config = await getKeycloakConfig();
    const currentUrl = new URL(KEYCLOAK_CALLBACK_URL);
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        currentUrl.searchParams.set(key, value);
      }
    }

    const tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: transaction.codeVerifier,
      expectedState: state,
      idTokenExpected: true,
    });

    const claims = tokens.claims();
    if (!claims) {
      res.redirect(`${clientFrontendUrl}/login?error=${encodeURIComponent('Data pengguna dari SSO tidak ditemukan.')}`);
      return;
    }

    const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : '';
    const username = typeof claims.preferred_username === 'string' ? claims.preferred_username.trim() : '';
    let nama = typeof claims.name === 'string' && claims.name.trim()
      ? claims.name.trim()
      : (typeof claims.given_name === 'string' && claims.given_name.trim()
        ? claims.given_name.trim()
        : username || email.split('@')[0] || 'Pengguna UNAND');

    console.log('[SSO] User dari Keycloak:', {
      email,
      preferred_username: username,
      name: nama,
      sub: claims.sub,
    });

    if (!email) {
      res.redirect(`${clientFrontendUrl}/login?error=${encodeURIComponent('Email tidak tersedia pada akun SSO.')}`);
      return;
    }

    // ─── 1. Deteksi Peran (Role) secara Cerdas & Akurat ───
    const isStudentEmail = email.endsWith('@student.unand.ac.id');
    const isOfficialUnandEmail =
      email.endsWith('@unand.ac.id') ||
      (email.endsWith('.unand.ac.id') && !isStudentEmail);

    // Cek apakah username (NIDN/NIP) atau email sudah terdaftar di tabel Dosen / Staff / Mahasiswa
    const dbDosen = await prisma.dosen.findFirst({
      where: {
        OR: [
          ...(username ? [{ nidn: username }] : []),
          { user: { email } },
        ],
      },
      include: { user: true },
    });

    const dbStaff = await prisma.staff.findFirst({
      where: {
        OR: [
          ...(username ? [{ nip: username }] : []),
          { user: { email } },
        ],
      },
      include: { user: true },
    });

    const dbMahasiswa = await prisma.mahasiswa.findFirst({
      where: {
        OR: [
          ...(username ? [{ nim: username }] : []),
          { user: { email } },
        ],
      },
      include: { user: true },
    });

    let peran: 'mahasiswa' | 'dosen' | 'staff' = 'mahasiswa';

    if (dbDosen) {
      peran = 'dosen';
    } else if (dbStaff) {
      peran = 'staff';
    } else if (isStudentEmail) {
      // Mahasiswa UNAND selalu menggunakan @student.unand.ac.id
      peran = 'mahasiswa';
    } else if (isOfficialUnandEmail) {
      // Email resmi UNAND (bukan @student) merupakan Dosen / Tendik
      peran = 'dosen';
    } else if (dbMahasiswa) {
      peran = 'mahasiswa';
    } else if (/^\d{18}$/.test(username)) {
      // NIP 18 digit
      peran = 'dosen';
    } else {
      peran = 'mahasiswa';
    }

    // SESUAI ARAHAN DTI: Gunakan Session SSO langsung tanpa menolak jika belum ada di database
    let userIdStr = username || email;
    let finalPeran = peran;
    let staffJabatan: string | undefined;
    let organisasiId: number | undefined;
    let namaOrganisasi: string | undefined;

    // Sinkronisasi DB Ringan (Graceful & Non-blocking agar modul kegiatan & poin tetap berfungsi)
    try {
      let user = await prisma.user.findUnique({
        where: { email },
        include: { dosen: true, mahasiswa: true, staff: true },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            nama,
            email,
            passwordHash: await hashPassword(crypto.randomUUID()),
            peran: peran as any,
            aktif: true,
          },
          include: { dosen: true, mahasiswa: true, staff: true },
        });
      } else {
        if (!user.aktif) {
          res.redirect(`${clientFrontendUrl}/login?error=${encodeURIComponent('Akun StudentConnect Anda dinonaktifkan. Hubungi admin.')}`);
          return;
        }

        // KOREKSI OTOMATIS: Jika user di database sebelumnya salah tercatat sebagai 'mahasiswa' padahal sebenarnya dosen
        if (peran === 'dosen' && user.peran !== 'dosen') {
          console.log(`[SSO Auto-Fix] Mengoreksi peran user ${email} dari ${user.peran} menjadi dosen`);
          user = await prisma.user.update({
            where: { id: user.id },
            data: { peran: 'dosen' },
            include: { dosen: true, mahasiswa: true, staff: true },
          });

          // Hapus record mahasiswa nyasar jika sempat terbuat salah sebelumnya
          await prisma.mahasiswa.deleteMany({
            where: { userId: user.id },
          });
        } else if (peran === 'staff' && user.peran !== 'staff') {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { peran: 'staff' },
            include: { dosen: true, mahasiswa: true, staff: true },
          });
        }

        finalPeran = user.peran as any;
        if (user.nama) nama = user.nama;
      }

      userIdStr = user.id.toString();

      // Penanganan role spesifik seperti staff & operator_org sesuai DTI
      if (user.peran === 'staff') {
        const staff = await prisma.staff.findUnique({
          where: { userId: user.id },
          select: { jabatan: true },
        });
        if (staff?.jabatan) {
          staffJabatan = staff.jabatan;
        }
      } else if (user.peran === 'operator_org') {
        const operator = await prisma.organisasiOperator.findUnique({
          where: { userId: user.id },
          include: {
            organisasi: {
              select: { id: true, nama: true },
            },
          },
        });
        if (operator) {
          organisasiId = operator.organisasiId;
          namaOrganisasi = operator.organisasi.nama;
        }
      } else if (user.peran === 'dosen') {
        const existingDosenRecord = await prisma.dosen.findUnique({ where: { userId: user.id } });
        if (!existingDosenRecord) {
          const matchedByNidn = username ? await prisma.dosen.findFirst({
            where: { nidn: username },
          }) : null;

          if (matchedByNidn && matchedByNidn.userId !== user.id) {
            await prisma.dosen.update({
              where: { userId: matchedByNidn.userId },
              data: { userId: user.id },
            });
          } else if (!matchedByNidn) {
            const defaultFakultas = await prisma.fakultas.findFirst();
            await prisma.dosen.create({
              data: {
                userId: user.id,
                nidn: username || `NIDN-${user.id}`,
                fakultasId: defaultFakultas?.id || 1,
              },
            });
          }
        }
        // Pastikan tidak ada data mahasiswa nyasar
        await prisma.mahasiswa.deleteMany({ where: { userId: user.id } });
      } else if (user.peran === 'mahasiswa') {
        const existingMhsRecord = await prisma.mahasiswa.findUnique({ where: { userId: user.id } });
        if (!existingMhsRecord) {
          let nim = username;
          if (!/^\d{10}$/.test(nim)) {
            const match = email.match(/^(\d{10})/);
            if (match) nim = match[1];
          }
          nim = nim || `NIM${user.id.toString().padStart(8, '0')}`;

          let angkatan = new Date().getFullYear();
          if (/^\d{2}/.test(nim)) {
            const prefixYear = parseInt(nim.substring(0, 2), 10);
            if (prefixYear >= 15 && prefixYear <= 40) angkatan = 2000 + prefixYear;
          }

          const defaultProdi = await prisma.programStudi.findFirst();
          const prodiId = defaultProdi?.id || 1;
          const kurikulumId = await resolveKurikulumIdForAngkatan(angkatan);

          await prisma.mahasiswa.create({
            data: {
              userId: user.id,
              nim,
              angkatan,
              prodiId,
              kurikulumId,
            },
          });
        }
      }
    } catch (syncErr) {
      console.warn('[SSO DB Graceful Sync]', syncErr);
    }

    const tokenPayload: Record<string, any> = {
      id: userIdStr,
      peran: finalPeran,
      role: finalPeran === 'staff' && staffJabatan ? staffJabatan : finalPeran,
      nama,
      email,
      nim: finalPeran === 'mahasiswa' ? (username || undefined) : undefined,
      nidn: finalPeran === 'dosen' ? (username || undefined) : undefined,
      jabatan: staffJabatan,
      organisasiId,
      namaOrganisasi,
    };

    const appToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

    res.redirect(`${clientFrontendUrl}/login?sso=success&token=${encodeURIComponent(appToken)}`);
  } catch (error: any) {
    console.error('SSO Callback Error:', error);
    res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent('Login SSO gagal: ' + (error?.message || 'Silakan coba kembali.'))}`);
  }
};

/**
 * GET /api/auth/sso/logout
 * Mengarahkan user ke logout Keycloak SSO UNAND
 */
export const ssoLogout = async (_req: Request, res: Response): Promise<void> => {
  const postLogoutRedirect = `${FRONTEND_URL}/login`;
  const logoutUrl = `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/logout?post_logout_redirect_uri=${encodeURIComponent(postLogoutRedirect)}&client_id=${encodeURIComponent(KEYCLOAK_CLIENT_ID)}`;
  res.redirect(logoutUrl);
};
