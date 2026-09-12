#!/usr/bin/env python3
"""
All-in-One Database Update Script
Runs: Backup → Sync → Verify in one command
"""

import sys
import os
from datetime import datetime

def run_command(name, command):
    """Run a Python script and report status"""
    print(f"\n{'='*60}")
    print(f"▶️  {name}")
    print(f"{'='*60}\n")
    
    exit_code = os.system(command)
    
    if exit_code == 0:
        print(f"\n✅ {name} completed successfully!\n")
        return True
    else:
        print(f"\n❌ {name} failed with exit code {exit_code}\n")
        return False

def main():
    print("\n" + "="*60)
    print("🚀 AUTOMATED DATABASE UPDATE")
    print("="*60)
    print("\nThis script will:")
    print("  1. 📦 Create a backup of your live database")
    print("  2. 🔄 Sync new categories and columns")
    print("  3. ✅ Verify everything is synced")
    print("\n⚠️  Make sure config.py has your LIVE server credentials!\n")
    
    response = input("Continue? (yes/no): ").strip().lower()
    
    if response not in ['yes', 'y']:
        print("\n❌ Update cancelled.")
        sys.exit(0)
    
    print("\n🔍 Checking requirements...")
    
    try:
        import mysql.connector
        print("✅ mysql-connector-python is installed")
    except ImportError:
        print("❌ mysql-connector-python is not installed")
        print("   Run: pip install mysql-connector-python")
        sys.exit(1)
    
    try:
        from config import MYSQL_CONFIG, USE_MYSQL
        if not USE_MYSQL:
            print("❌ USE_MYSQL is False in config.py")
            print("   Please set USE_MYSQL = True for live server")
            sys.exit(1)
        print("✅ config.py is properly configured")
    except Exception as e:
        print(f"❌ Error reading config.py: {e}")
        sys.exit(1)
    
    # Step 1: Backup
    if not run_command("Step 1: Creating Database Backup", "python3 backup_database.py"):
        print("⚠️  Backup failed. Stopping update for safety.")
        sys.exit(1)
    
    # Step 2: Sync
    if not run_command("Step 2: Syncing Database", "python3 sync_database.py"):
        print("⚠️  Sync completed with errors. Check the output above.")
        print("   Your backup file is saved. You can restore if needed.")
        sys.exit(1)
    
    # Step 3: Success message
    print("="*60)
    print("🎉 DATABASE UPDATE COMPLETE!")
    print("="*60)
    print("\n✅ Your database has been successfully updated!")
    print("\n📋 Next Steps:")
    print("   1. Restart your Flask server")
    print("   2. Clear browser cache (Ctrl+Shift+Delete)")
    print("   3. Reload dashboard (Ctrl+Shift+R)")
    print("   4. Verify all categories show correctly")
    print("\n💾 Backup file saved for recovery if needed\n")

if __name__ == "__main__":
    main()
