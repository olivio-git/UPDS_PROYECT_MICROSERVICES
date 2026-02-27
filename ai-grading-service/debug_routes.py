#!/usr/bin/env python3
"""
Debug script to check available routes in AI Grading Service
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

def debug_routes():
    print("🔍 Debugging AI Grading Service Routes")
    print("=" * 50)
    
    try:
        # Test import of main app
        print("1. Testing main app import...")
        from src.main import app
        print("   ✅ Main app imported successfully")
        
        # List all routes
        print("\n2. Available routes:")
        for route in app.routes:
            if hasattr(route, 'methods') and hasattr(route, 'path'):
                methods = ', '.join(route.methods)
                print(f"   {methods:10} {route.path}")
            elif hasattr(route, 'path'):
                print(f"   {'MOUNT':10} {route.path}")
        
        # Test grading controller import
        print("\n3. Testing grading controller import...")
        from src.controllers.grading_controller import router as grading_router
        print("   ✅ Grading controller imported successfully")
        
        # List grading router routes
        print("\n4. Grading router routes:")
        for route in grading_router.routes:
            if hasattr(route, 'methods') and hasattr(route, 'path'):
                methods = ', '.join(route.methods)
                full_path = f"/api/v1{grading_router.prefix}{route.path}"
                print(f"   {methods:10} {full_path}")
        
        # Test text grading service
        print("\n5. Testing text grading service...")
        from src.services.text_grading_service import TextGradingService
        print("   ✅ TextGradingService imported successfully")
        
        # Test schemas
        print("\n6. Testing schemas...")
        from src.schemas.grading import WritingEvaluationRequest, WritingEvaluationResponse
        print("   ✅ Schemas imported successfully")
        
        print("\n✅ All components seem to be working correctly!")
        
    except Exception as e:
        print(f"❌ Error during debugging: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_routes()
