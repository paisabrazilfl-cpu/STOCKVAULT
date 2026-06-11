import threading

class TenantContext:
    _local = threading.local()
    @classmethod
    def set_tenant_id(cls, tenant_id: str):
        cls._local.tenant_id = tenant_id
    @classmethod
    def get_tenant_id(cls) -> str:
        return getattr(cls._local, 'tenant_id', 'default_tenant')
    @classmethod
    def clear(cls):
        if hasattr(cls._local, 'tenant_id'):
            del cls._local.tenant_id
