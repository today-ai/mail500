import { DatabaseSync,backup } from 'node:sqlite';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
const source=process.env.DATABASE_PATH||resolve('data/dispatch.sqlite');
const dir=resolve(process.env.BACKUP_PATH||'backups');mkdirSync(dir,{recursive:true});
const db=new DatabaseSync(source,{readOnly:true});
const destination=resolve(dir,'dispatch-'+new Date().toISOString().replace(/[:.]/g,'-')+'.sqlite');
await backup(db,destination);db.close();console.log('Database backed up to '+destination);
