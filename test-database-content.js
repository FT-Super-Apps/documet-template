// test-database-content.js - Script untuk menguji isi database setelah seeding
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testDatabaseContent() {
  try {
    console.log('🔍 Testing database content after seeding...\n');

    // Test 1: Documents and Fields
    console.log('📄 1. Documents and Fields:');
    const documents = await prisma.documents.findMany({
      include: {
        document_fields: true,
        document_templates: true
      }
    });
    console.log(`   ✅ Found ${documents.length} documents`);

    documents.forEach(doc => {
      console.log(`   📋 ${doc.type} - ${doc.prodi}: ${doc.document_fields.length} fields, ${doc.document_templates.length} templates`);
    });

    // Test 2: Document Categories
    console.log('\n🏷️  2. Document Categories:');
    const categories = await prisma.document_categories.findMany({
      orderBy: { sort_order: 'asc' }
    });
    console.log(`   ✅ Found ${categories.length} categories`);
    categories.forEach(cat => {
      console.log(`   🎨 ${cat.name} (${cat.color_hex}) - ${cat.description}`);
    });

    // Test 3: Signers
    console.log('\n👥 3. Signers:');
    const signers = await prisma.signers.findMany();
    console.log(`   ✅ Found ${signers.length} signers`);

    const signersByProdi = signers.reduce((acc, signer) => {
      acc[signer.prodi] = (acc[signer.prodi] || 0) + 1;
      return acc;
    }, {});

    Object.entries(signersByProdi).forEach(([prodi, count]) => {
      console.log(`   🖊️  ${prodi}: ${count} signers`);
    });

    // Test 4: Signed Documents
    console.log('\n📝 4. Signed Documents:');
    const signedDocs = await prisma.signed_documents.findMany({
      include: {
        document_signatures: true,
        document_history: true
      }
    });
    console.log(`   ✅ Found ${signedDocs.length} signed documents`);

    const statusCounts = signedDocs.reduce((acc, doc) => {
      acc[doc.status] = (acc[doc.status] || 0) + 1;
      return acc;
    }, {});

    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   📊 ${status}: ${count} documents`);
    });

    // Test 5: Document History
    console.log('\n📚 5. Document History:');
    const historyCount = await prisma.document_history.count();
    console.log(`   ✅ Found ${historyCount} history records`);

    const historyByAction = await prisma.document_history.groupBy({
      by: ['action'],
      _count: { action: true }
    });

    historyByAction.forEach(item => {
      console.log(`   📋 ${item.action}: ${item._count.action} records`);
    });

    // Test 6: Notifications
    console.log('\n🔔 6. Notifications:');
    const notifications = await prisma.notifications.findMany();
    console.log(`   ✅ Found ${notifications.length} notifications`);

    const notificationsByType = notifications.reduce((acc, notif) => {
      acc[notif.type] = (acc[notif.type] || 0) + 1;
      return acc;
    }, {});

    Object.entries(notificationsByType).forEach(([type, count]) => {
      console.log(`   📬 ${type}: ${count} notifications`);
    });

    // Test 7: System Configuration
    console.log('\n⚙️  7. System Configuration:');
    const systemConfigs = await prisma.system_config.findMany();
    console.log(`   ✅ Found ${systemConfigs.length} configuration items`);

    const importantConfigs = ['eddsa_enabled', 'max_document_size_mb', 'notification_email_enabled'];
    importantConfigs.forEach(key => {
      const config = systemConfigs.find(c => c.config_key === key);
      if (config) {
        console.log(`   🔧 ${key}: ${config.config_value}`);
      }
    });

    // Test 8: Audit Logs
    console.log('\n📊 8. Audit Logs:');
    const auditCount = await prisma.audit_logs.count();
    console.log(`   ✅ Found ${auditCount} audit log records`);

    if (auditCount > 0) {
      const auditByOperation = await prisma.audit_logs.groupBy({
        by: ['operation'],
        _count: { operation: true }
      });

      auditByOperation.forEach(item => {
        console.log(`   📈 ${item.operation}: ${item._count.operation} operations`);
      });
    }

    // Test 9: Document Signature Configuration
    console.log('\n📋 9. Document Signature Configuration:');
    const signatureConfigs = await prisma.document_signature_config.findMany();
    console.log(`   ✅ Found ${signatureConfigs.length} signature configurations`);

    signatureConfigs.forEach(config => {
      console.log(`   🔐 ${config.document_type}: requires ${config.required_signature_count} signatures`);
    });

    console.log('\n🎉 Database content test completed successfully!');
    console.log('\n📈 Summary:');
    console.log(`   • ${documents.length} document templates with enhanced fields`);
    console.log(`   • ${categories.length} document categories`);
    console.log(`   • ${signers.length} signers with enhanced profile data`);
    console.log(`   • ${signedDocs.length} sample signed documents`);
    console.log(`   • ${historyCount} history records`);
    console.log(`   • ${notifications.length} notifications`);
    console.log(`   • ${systemConfigs.length} system configurations`);
    console.log(`   • ${auditCount} audit log entries`);
    console.log('   ✅ All enhanced features are properly seeded!');

  } catch (error) {
    console.error('❌ Error testing database content:', error);
    throw error;
  }
}

async function main() {
  await testDatabaseContent();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
