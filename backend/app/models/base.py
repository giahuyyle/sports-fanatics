from pydantic import BaseModel, ConfigDict


class RequestModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ORMResponseModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)