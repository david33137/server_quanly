import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Bắt đầu seed dữ liệu mẫu...');

  // Create teams
  const teamA = await prisma.team.upsert({
    where: { id: 'team-alpha' },
    update: {},
    create: { id: 'team-alpha', name: 'Team Alpha', description: 'Nhóm chuyên reup kênh giải trí' },
  });
  const teamB = await prisma.team.upsert({
    where: { id: 'team-beta' },
    update: {},
    create: { id: 'team-beta', name: 'Team Beta', description: 'Nhóm chuyên reup kênh giáo dục' },
  });

  const round = 10;

  // Create users
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ytreup.com' },
    update: {},
    create: {
      email: 'admin@ytreup.com',
      password: await bcrypt.hash('Admin@123', round),
      name: 'Admin',
      role: 'ADMIN',
    },
  });

  const managerA = await prisma.user.upsert({
    where: { email: 'manager.alpha@ytreup.com' },
    update: {},
    create: {
      email: 'manager.alpha@ytreup.com',
      password: await bcrypt.hash('Manager@123', round),
      name: 'Nguyễn Văn Manager',
      role: 'MANAGER',
      teamId: teamA.id,
    },
  });

  const sourcerA = await prisma.user.upsert({
    where: { email: 'sourcer1@ytreup.com' },
    update: {},
    create: {
      email: 'sourcer1@ytreup.com',
      password: await bcrypt.hash('Sourcer@123', round),
      name: 'Trần Thị Sourcer',
      role: 'SOURCER',
      teamId: teamA.id,
    },
  });

  const editorA = await prisma.user.upsert({
    where: { email: 'editor1@ytreup.com' },
    update: {},
    create: {
      email: 'editor1@ytreup.com',
      password: await bcrypt.hash('Editor@123', round),
      name: 'Lê Văn Editor',
      role: 'EDITOR',
      teamId: teamA.id,
    },
  });

  // Update team managers
  await prisma.team.update({ where: { id: teamA.id }, data: { managerId: managerA.id } });

  // Create Gmail accounts
  const gmail1 = await prisma.gmailAccount.upsert({
    where: { email: 'channel.alpha01@gmail.com' },
    update: {},
    create: {
      email: 'channel.alpha01@gmail.com',
      passwordEnc: await bcrypt.hash('GmailPass@123', round),
      recoveryEmail: 'recovery01@example.com',
      status: 'ACTIVE',
      notes: 'Gmail chính cho kênh Alpha 01',
      teamId: teamA.id,
    },
  });

  const gmail2 = await prisma.gmailAccount.upsert({
    where: { email: 'channel.alpha02@gmail.com' },
    update: {},
    create: {
      email: 'channel.alpha02@gmail.com',
      passwordEnc: await bcrypt.hash('GmailPass@456', round),
      status: 'ACTIVE',
      notes: 'Gmail backup',
      teamId: teamA.id,
    },
  });

  // Create YouTube channels
  const ch1 = await prisma.youTubeChannel.create({
    data: {
      name: 'Alpha Entertainment VN',
      channelUrl: 'https://youtube.com/@AlphaEntertainmentVN',
      channelId: 'UC_alpha01',
      gmailId: gmail1.id,
      teamId: teamA.id,
      status: 'ACTIVE',
      subscribers: 12500,
      language: 'vi',
      niche: 'Giải trí, Phim',
    },
  });

  const ch2 = await prisma.youTubeChannel.create({
    data: {
      name: 'Alpha Comedy VN',
      channelUrl: 'https://youtube.com/@AlphaComedyVN',
      channelId: 'UC_alpha02',
      gmailId: gmail2.id,
      teamId: teamA.id,
      status: 'ACTIVE',
      subscribers: 8200,
      language: 'vi',
      niche: 'Hài kịch',
    },
  });

  // Create sample sources and jobs
  const source1 = await prisma.videoSource.create({
    data: {
      sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      sourceType: 'YOUTUBE',
      title: 'Sample English Comedy Video',
      addedById: sourcerA.id,
      teamId: teamA.id,
    },
  });

  // Sample jobs across different pipeline stages
  await prisma.videoJob.createMany({
    data: [
      {
        sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        videoSourceId: source1.id,
        title: 'Sample Comedy - Chờ duyệt',
        targetChannelId: ch1.id,
        teamId: teamA.id,
        currentStep: 'SOURCING',
        priority: 'NORMAL',
      },
      {
        sourceUrl: 'https://www.youtube.com/watch?v=abc123example',
        title: 'Travel Vlog - Đang xử lý',
        targetChannelId: ch2.id,
        teamId: teamA.id,
        assignedToId: editorA.id,
        currentStep: 'PROCESSING',
        priority: 'HIGH',
        progress: 45,
      },
      {
        sourceUrl: 'https://www.youtube.com/watch?v=xyz789example',
        title: 'Cooking Tutorial - Chờ upload',
        targetChannelId: ch1.id,
        teamId: teamA.id,
        currentStep: 'WAITING_UPLOAD',
        priority: 'NORMAL',
        outputPath: '/outputs/cooking_tutorial_vi.mp4',
        progress: 100,
      },
      {
        sourceUrl: 'https://www.youtube.com/watch?v=done123example',
        title: 'Music Video - Đã xong',
        targetChannelId: ch1.id,
        uploadedChannelId: ch1.id,
        uploadedUrl: 'https://youtube.com/watch?v=uploaded123',
        teamId: teamA.id,
        currentStep: 'DONE',
        priority: 'NORMAL',
        progress: 100,
        completedAt: new Date(),
      },
    ],
  });

  console.log('✅ Seed hoàn tất!');
  console.log('');
  console.log('📋 Tài khoản mẫu:');
  console.log('  Admin:   admin@ytreup.com / Admin@123');
  console.log('  Manager: manager.alpha@ytreup.com / Manager@123');
  console.log('  Sourcer: sourcer1@ytreup.com / Sourcer@123');
  console.log('  Editor:  editor1@ytreup.com / Editor@123');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
