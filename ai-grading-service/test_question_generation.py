#!/usr/bin/env python3
"""
Test script for AI Question Generation Service
"""

import asyncio
import json
import logging
import aiohttp
from typing import Dict, Any

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class QuestionGenerationTester:
    def __init__(self, base_url: str = "http://localhost:3006"):
        self.base_url = base_url
        self.session = None

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def test_health(self) -> bool:
        """Test service health"""
        try:
            async with self.session.get(f"{self.base_url}/health") as response:
                if response.status == 200:
                    data = await response.json()
                    logger.info(f"✅ Health check passed: {data}")
                    return True
                else:
                    logger.error(f"❌ Health check failed: {response.status}")
                    return False
        except Exception as e:
            logger.error(f"❌ Health check error: {e}")
            return False

    async def test_capabilities(self) -> bool:
        """Test capabilities endpoint"""
        try:
            async with self.session.get(f"{self.base_url}/api/v1/questions/capabilities") as response:
                if response.status == 200:
                    data = await response.json()
                    logger.info("✅ Capabilities endpoint working")
                    logger.info(f"   Competencies: {len(data['capabilities']['competencies'])}")
                    logger.info(f"   Question types: {len(data['capabilities']['question_types'])}")
                    logger.info(f"   MCER levels: {len(data['capabilities']['mcer_levels'])}")
                    return True
                else:
                    logger.error(f"❌ Capabilities test failed: {response.status}")
                    return False
        except Exception as e:
            logger.error(f"❌ Capabilities test error: {e}")
            return False

    async def test_status(self) -> bool:
        """Test status endpoint"""
        try:
            async with self.session.get(f"{self.base_url}/api/v1/questions/status") as response:
                if response.status == 200:
                    data = await response.json()
                    logger.info("✅ Status endpoint working")
                    logger.info(f"   Service status: {data.get('status')}")
                    logger.info(f"   LLM available: {data.get('llm_available')}")
                    return True
                else:
                    logger.error(f"❌ Status test failed: {response.status}")
                    return False
        except Exception as e:
            logger.error(f"❌ Status test error: {e}")
            return False

    async def test_generation(self, request_data: Dict[str, Any]) -> bool:
        """Test question generation"""
        try:
            logger.info(f"🔄 Testing generation: {request_data['competency']} | {request_data['question_type']} | {request_data['level']}")

            async with self.session.post(
                f"{self.base_url}/api/v1/questions/generate",
                json=request_data,
                headers={"Content-Type": "application/json"}
            ) as response:

                response_text = await response.text()
                logger.info(f"Response status: {response.status}")
                logger.info(f"Response text (first 200 chars): {response_text[:200]}")

                if response.status == 200:
                    try:
                        data = json.loads(response_text)
                        if data.get("success") and data.get("generated_questions"):
                            question = data["generated_questions"][0]
                            logger.info("✅ Generation successful")
                            logger.info(f"   Processing time: {data.get('processing_time', 0):.2f}s")
                            logger.info(f"   Model used: {data.get('model_used')}")
                            logger.info(f"   Confidence: {data.get('confidence_score', 0):.2f}")
                            logger.info(f"   Question: {question['content']['question'][:100]}...")

                            if question['content'].get('options'):
                                logger.info(f"   Options: {len(question['content']['options'])}")

                            return True
                        else:
                            logger.error(f"❌ Generation failed: {data.get('message', 'Unknown error')}")
                            return False
                    except json.JSONDecodeError as e:
                        logger.error(f"❌ Failed to parse JSON response: {e}")
                        return False
                else:
                    logger.error(f"❌ Generation request failed: {response.status}")
                    logger.error(f"   Response: {response_text}")
                    return False

        except Exception as e:
            logger.error(f"❌ Generation test error: {e}")
            return False

    async def run_tests(self):
        """Run all tests"""
        logger.info("🚀 Starting AI Question Generation Service Tests")

        test_results = []

        # Test 1: Health Check
        logger.info("\n📋 Test 1: Health Check")
        test_results.append(await self.test_health())

        # Test 2: Capabilities
        logger.info("\n📋 Test 2: Capabilities")
        test_results.append(await self.test_capabilities())

        # Test 3: Status
        logger.info("\n📋 Test 3: Status")
        test_results.append(await self.test_status())

        # Test 4: Reading Multiple Choice Generation
        logger.info("\n📋 Test 4: Reading Multiple Choice Generation")
        reading_request = {
            "competency": "reading",
            "question_type": "multiple_choice",
            "level": "B1",
            "difficulty": 3,
            "topic": "viajes",
            "question_count": 1
        }
        test_results.append(await self.test_generation(reading_request))

        # Test 5: Writing Essay Generation
        logger.info("\n📋 Test 5: Writing Essay Generation")
        writing_request = {
            "competency": "writing",
            "question_type": "essay",
            "level": "B2",
            "difficulty": 4,
            "topic": "tecnología",
            "question_count": 1
        }
        test_results.append(await self.test_generation(writing_request))

        # Test 6: Grammar Fill Blanks
        logger.info("\n📋 Test 6: Grammar Fill Blanks")
        grammar_request = {
            "competency": "grammar",
            "question_type": "fill_blanks",
            "level": "A2",
            "difficulty": 2,
            "topic": "verbos",
            "question_count": 1
        }
        test_results.append(await self.test_generation(grammar_request))

        # Summary
        passed = sum(test_results)
        total = len(test_results)

        logger.info(f"\n🎯 Test Summary: {passed}/{total} tests passed")

        if passed == total:
            logger.info("🎉 All tests passed! Service is working correctly.")
        else:
            logger.warning(f"⚠️  {total - passed} tests failed. Check the logs above.")

        return passed == total

async def main():
    """Main test function"""
    # You can change the URL here if testing a different deployment
    service_url = "http://localhost:3006"  # Local development
    # service_url = "https://ollama-354865198391.us-central1.run.app"  # Your cloud service

    async with QuestionGenerationTester(service_url) as tester:
        success = await tester.run_tests()
        return success

if __name__ == "__main__":
    try:
        success = asyncio.run(main())
        exit(0 if success else 1)
    except KeyboardInterrupt:
        logger.info("\n🛑 Tests cancelled by user")
        exit(1)
    except Exception as e:
        logger.error(f"❌ Test runner error: {e}")
        exit(1)