import logging
from typing import Dict, Any

# ============================================================================
#  ZeaZ AI Platform — Universal AI Router gateway (100 Providers Registration)
# ============================================================================

from ai.providers.openai import OpenAIProvider
from ai.providers.gemini import GeminiProvider
from ai.providers.claude import ClaudeProvider
from ai.providers.deepseek import DeepSeekProvider
from ai.providers.ollama import OllamaProvider
from ai.providers.mistral import MistralProvider
from ai.providers.cohere import CohereProvider
from ai.providers.groq import GroqProvider
from ai.providers.together import TogetherProvider
from ai.providers.openrouter import OpenRouterProvider
from ai.providers.aws_bedrock import AWSBedrockProvider
from ai.providers.azure_openai import AzureOpenAIProvider
from ai.providers.cloudflare_ai import CloudflareAIProvider
from ai.providers.perplexity import PerplexityProvider
from ai.providers.huggingface import HuggingFaceProvider
from ai.providers.replicate import ReplicateProvider
from ai.providers.fireworks import FireworksProvider
from ai.providers.novita import NovitaProvider
from ai.providers.deepinfra import DeepInfraProvider
from ai.providers.xai import XAIProvider
from ai.providers.vertex_ai import VertexAiProvider
from ai.providers.github_copilot import GithubCopilotProvider
from ai.providers.ibm_watsonx import IbmWatsonxProvider
from ai.providers.alibaba_dashscope import AlibabaDashscopeProvider
from ai.providers.baidu_qianfan import BaiduQianfanProvider
from ai.providers.tencent_hunyuan import TencentHunyuanProvider
from ai.providers.sensetime_novamind import SensetimeNovamindProvider
from ai.providers.huawei_pangu import HuaweiPanguProvider
from ai.providers.zero1_ai import Zero1AiProvider
from ai.providers.baichuan_ai import BaichuanAiProvider
from ai.providers.eleuther_ai import EleutherAiProvider
from ai.providers.stability_ai import StabilityAiProvider
from ai.providers.midjourney import MidjourneyProvider
from ai.providers.runway import RunwayProvider
from ai.providers.luma_dream_machine import LumaDreamMachineProvider
from ai.providers.sora import SoraProvider
from ai.providers.pika_labs import PikaLabsProvider
from ai.providers.heygen import HeygenProvider
from ai.providers.synthesia import SynthesiaProvider
from ai.providers.elevenlabs import ElevenlabsProvider
from ai.providers.playht import PlayhtProvider
from ai.providers.lm_studio import LmStudioProvider
from ai.providers.koboldcpp import KoboldcppProvider
from ai.providers.vllm import VllmProvider
from ai.providers.tgi import TgiProvider
from ai.providers.llama_cpp import LlamaCppProvider
from ai.providers.onnx_runtime import OnnxRuntimeProvider
from ai.providers.webgpu import WebgpuProvider
from ai.providers.apple_coreml import AppleCoremlProvider
from ai.providers.android_nnapi import AndroidNnapiProvider
from ai.providers.anyscale import AnyscaleProvider
from ai.providers.lepton_ai import LeptonAiProvider
from ai.providers.runpod import RunpodProvider
from ai.providers.vast_ai import VastAiProvider
from ai.providers.lambda_labs import LambdaLabsProvider
from ai.providers.paperspace import PaperspaceProvider
from ai.providers.coreweave import CoreweaveProvider
from ai.providers.fluid_stack import FluidStackProvider
from ai.providers.octoai import OctoaiProvider
from ai.providers.baseten import BasetenProvider
from ai.providers.modal_labs import ModalLabsProvider
from ai.providers.replicate_deployments import ReplicateDeploymentsProvider
from ai.providers.predibase import PredibaseProvider
from ai.providers.cerebras import CerebrasProvider
from ai.providers.samba_nova import SambaNovaProvider
from ai.providers.neuralspeed import NeuralspeedProvider
from ai.providers.onnx_web import OnnxWebProvider
from ai.providers.assembly_ai import AssemblyAiProvider
from ai.providers.deepgram import DeepgramProvider
from ai.providers.whisper_api import WhisperApiProvider
from ai.providers.gladia import GladiaProvider
from ai.providers.speechmatics import SpeechmaticsProvider
from ai.providers.vocalremover import VocalremoverProvider
from ai.providers.audiocraft import AudiocraftProvider
from ai.providers.suno_ai import SunoAiProvider
from ai.providers.udio import UdioProvider
from ai.providers.dall_e import DallEProvider
from ai.providers.imagen import ImagenProvider
from ai.providers.flux_ai import FluxAiProvider
from ai.providers.leonardo_ai import LeonardoAiProvider
from ai.providers.adobe_firefly import AdobeFireflyProvider
from ai.providers.recraft_ai import RecraftAiProvider
from ai.providers.photoroom import PhotoroomProvider
from ai.providers.remove_bg import RemoveBgProvider
from ai.providers.clipdrop import ClipdropProvider
from ai.providers.pinecone import PineconeProvider
from ai.providers.qdrant_cloud import QdrantCloudProvider
from ai.providers.weaviate_cloud import WeaviateCloudProvider
from ai.providers.milvus_zilliz import MilvusZillizProvider
from ai.providers.chromadb_cloud import ChromadbCloudProvider
from ai.providers.jina_ai import JinaAiProvider
from ai.providers.voyage_ai import VoyageAiProvider
from ai.providers.mixedbread_ai import MixedbreadAiProvider
from ai.providers.upstage_ai import UpstageAiProvider
from ai.providers.unstructured_io import UnstructuredIoProvider
from ai.providers.tavily import TavilyProvider
from ai.providers.exa_search import ExaSearchProvider
from ai.providers.serpapi import SerpapiProvider
from ai.providers.google_search_api import GoogleSearchApiProvider
from ai.providers.brave_search_api import BraveSearchApiProvider

from ai.caching import AICache
from ai.cost_control import AICostController
from ai.fallback import AIFallbackManager
from ai.prompt_registry import PromptRegistry
from ai.guardrails import AIGuardrails
from ai.routing_rules import AIRoutingRules
from ai.metrics import AIMetricsTracker

class AIRouter:
    def __init__(self):
        self.providers = {
            "openai": OpenAIProvider(),
            "gemini": GeminiProvider(),
            "claude": ClaudeProvider(),
            "deepseek": DeepSeekProvider(),
            "ollama": OllamaProvider(),
            "mistral": MistralProvider(),
            "cohere": CohereProvider(),
            "groq": GroqProvider(),
            "together": TogetherProvider(),
            "openrouter": OpenRouterProvider(),
            "aws_bedrock": AWSBedrockProvider(),
            "azure_openai": AzureOpenAIProvider(),
            "cloudflare_ai": CloudflareAIProvider(),
            "perplexity": PerplexityProvider(),
            "huggingface": HuggingFaceProvider(),
            "replicate": ReplicateProvider(),
            "fireworks": FireworksProvider(),
            "novita": NovitaProvider(),
            "deepinfra": DeepInfraProvider(),
            "xai": XAIProvider(),
            "vertex_ai": VertexAiProvider(),
            "github_copilot": GithubCopilotProvider(),
            "ibm_watsonx": IbmWatsonxProvider(),
            "alibaba_dashscope": AlibabaDashscopeProvider(),
            "baidu_qianfan": BaiduQianfanProvider(),
            "tencent_hunyuan": TencentHunyuanProvider(),
            "sensetime_novamind": SensetimeNovamindProvider(),
            "huawei_pangu": HuaweiPanguProvider(),
            "zero1_ai": Zero1AiProvider(),
            "baichuan_ai": BaichuanAiProvider(),
            "eleuther_ai": EleutherAiProvider(),
            "stability_ai": StabilityAiProvider(),
            "midjourney": MidjourneyProvider(),
            "runway": RunwayProvider(),
            "luma_dream_machine": LumaDreamMachineProvider(),
            "sora": SoraProvider(),
            "pika_labs": PikaLabsProvider(),
            "heygen": HeygenProvider(),
            "synthesia": SynthesiaProvider(),
            "elevenlabs": ElevenlabsProvider(),
            "playht": PlayhtProvider(),
            "lm_studio": LmStudioProvider(),
            "koboldcpp": KoboldcppProvider(),
            "vllm": VllmProvider(),
            "tgi": TgiProvider(),
            "llama_cpp": LlamaCppProvider(),
            "onnx_runtime": OnnxRuntimeProvider(),
            "webgpu": WebgpuProvider(),
            "apple_coreml": AppleCoremlProvider(),
            "android_nnapi": AndroidNnapiProvider(),
            "anyscale": AnyscaleProvider(),
            "lepton_ai": LeptonAiProvider(),
            "runpod": RunpodProvider(),
            "vast_ai": VastAiProvider(),
            "lambda_labs": LambdaLabsProvider(),
            "paperspace": PaperspaceProvider(),
            "coreweave": CoreweaveProvider(),
            "fluid_stack": FluidStackProvider(),
            "octoai": OctoaiProvider(),
            "baseten": BasetenProvider(),
            "modal_labs": ModalLabsProvider(),
            "replicate_deployments": ReplicateDeploymentsProvider(),
            "predibase": PredibaseProvider(),
            "cerebras": CerebrasProvider(),
            "samba_nova": SambaNovaProvider(),
            "neuralspeed": NeuralspeedProvider(),
            "onnx_web": OnnxWebProvider(),
            "assembly_ai": AssemblyAiProvider(),
            "deepgram": DeepgramProvider(),
            "whisper_api": WhisperApiProvider(),
            "gladia": GladiaProvider(),
            "speechmatics": SpeechmaticsProvider(),
            "vocalremover": VocalremoverProvider(),
            "audiocraft": AudiocraftProvider(),
            "suno_ai": SunoAiProvider(),
            "udio": UdioProvider(),
            "dall_e": DallEProvider(),
            "imagen": ImagenProvider(),
            "flux_ai": FluxAiProvider(),
            "leonardo_ai": LeonardoAiProvider(),
            "adobe_firefly": AdobeFireflyProvider(),
            "recraft_ai": RecraftAiProvider(),
            "photoroom": PhotoroomProvider(),
            "remove_bg": RemoveBgProvider(),
            "clipdrop": ClipdropProvider(),
            "pinecone": PineconeProvider(),
            "qdrant_cloud": QdrantCloudProvider(),
            "weaviate_cloud": WeaviateCloudProvider(),
            "milvus_zilliz": MilvusZillizProvider(),
            "chromadb_cloud": ChromadbCloudProvider(),
            "jina_ai": JinaAiProvider(),
            "voyage_ai": VoyageAiProvider(),
            "mixedbread_ai": MixedbreadAiProvider(),
            "upstage_ai": UpstageAiProvider(),
            "unstructured_io": UnstructuredIoProvider(),
            "tavily": TavilyProvider(),
            "exa_search": ExaSearchProvider(),
            "serpapi": SerpapiProvider(),
            "google_search_api": GoogleSearchApiProvider(),
            "brave_search_api": BraveSearchApiProvider(),
        }
        self.cache = AICache()
        self.cost_controller = AICostController()
        self.fallback_manager = AIFallbackManager()
        self.prompt_registry = PromptRegistry()
        self.guardrails = AIGuardrails()
        self.routing_rules = AIRoutingRules()
        self.metrics = AIMetricsTracker()

    def route_request(self, prompt_id: str, context: Dict[str, Any], preferred_provider: str = "claude") -> Dict[str, Any]:
        # Cost Control Check
        if self.cost_controller.check_budget_exceeded():
            preferred_provider = "ollama"  # Fallback to local
        
        # Render prompt content through registry
        prompt_content = self.prompt_registry.render(prompt_id, context)
        system_prompt = self.prompt_registry.get_system_prompt(prompt_id) or context.get("system_prompt", "")

        # 1. Guardrails Input Check
        is_safe, safety_reason = self.guardrails.validate_input(prompt_content)
        if not is_safe:
            return {"status": "blocked", "reason": safety_reason, "data": "Request blocked by safety policy."}

        # 2. Dynamic Routing Rules Choice
        chosen_provider = self.routing_rules.determine_optimal_provider(prompt_content, preferred_provider)

        # Caching Check
        cached_res = self.cache.get(prompt_id, context)
        if cached_res:
            self.metrics.record_cache(hit=True)
            logging.info(f"Cache hit for prompt: {prompt_id}")
            return cached_res
        
        self.metrics.record_cache(hit=False)

        # Set fallback chain preference order
        chain = [chosen_provider, "gemini", "deepseek", "ollama"]
        
        # Execute via Fallback Manager
        def execute_fn(p_name: str) -> Dict[str, Any]:
            import time
            start = time.time()
            try:
                res = self._execute_with_provider(p_name, prompt_content, system_prompt, context)
                self.metrics.record_call(p_name, time.time() - start, success=True)
                return res
            except Exception as e:
                self.metrics.record_call(p_name, time.time() - start, success=False)
                raise

        try:
            response = self.fallback_manager.execute_with_fallback(chain, execute_fn)
            
            # 3. Clean Output Guardrails
            response["data"] = self.guardrails.clean_output(response["data"])
            
            # Track cost upon successful completion
            self.cost_controller.track_call(response["provider"])
            # Save to Cache
            self.cache.set(prompt_id, context, response)
            return response
        except Exception as e:
            logging.critical(f"Global routing failure: {e}")
            raise

    def _execute_with_provider(self, provider_name: str, prompt: str, system_prompt: str, context: Dict[str, Any]) -> Dict[str, Any]:
        provider = self.providers.get(provider_name)
        if not provider:
            raise ValueError(f"Unknown provider: {provider_name}")
        
        # Pull extra options from context if present
        options = context.get("options", {})
        result_text = provider.generate(prompt, system_prompt=system_prompt, **options)
        return {"status": "success", "data": result_text, "provider": provider_name}
