import { PrismaClient, RoleType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');
  
  // Crear roles
  console.log('Creating roles...');
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { name: RoleType.CAJA },
      update: {},
      create: { name: RoleType.CAJA },
    }),
    prisma.role.upsert({
      where: { name: RoleType.MESERO },
      update: {},
      create: { name: RoleType.MESERO },
    }),
    prisma.role.upsert({
      where: { name: RoleType.COCINA },
      update: {},
      create: { name: RoleType.COCINA },
    }),
  ]);
  
  console.log('✅ Roles created:', roles.map(r => r.name));
  
  // Crear usuario admin por defecto (solo si no existe)
  const adminEmail = 'admin@chanatos.com';
  const adminPassword = 'admin123';
  
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });
  
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const cajaRole = roles.find(r => r.name === RoleType.CAJA);
    
    if (cajaRole) {
      await prisma.user.create({
        data: {
          email: adminEmail,
          password: hashedPassword,
          name: 'Administrador',
          roleId: cajaRole.id,
        },
      });
      
      console.log('✅ Admin user created:');
      console.log(`   Email: ${adminEmail}`);
      console.log(`   Password: ${adminPassword}`);
      console.log('   ⚠️  CHANGE THIS PASSWORD IN PRODUCTION!');
    }
  } else {
    console.log('ℹ️  Admin user already exists');
  }
  
  console.log('✅ Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

