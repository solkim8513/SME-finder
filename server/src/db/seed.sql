-- Default admin account
-- Email: admin@example.com  /  Password: Admin1234!
-- (bcrypt hash of "Admin1234!" with cost=12)
INSERT INTO users (email, password_hash, first_name, last_name, role)
VALUES (
  'admin@example.com',
  '$2a$12$DgWgNE/ay45fEUMpu2Ym7.xsToSvvhuC7VA7EP0Iw6CbTKMbURjk2',
  'Admin',
  'User',
  'admin'
)
ON CONFLICT (email) DO NOTHING;
