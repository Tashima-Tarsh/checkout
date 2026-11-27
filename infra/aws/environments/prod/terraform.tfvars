terraform {
  backend "s3" {
    bucket         = "disha8-2-tfstate"
    key            = "infrastructure/prod/terraform.tfstate"
    region         = "ap-southeast-2"
    encrypt        = true
    dynamodb_table = "disha8-2-terraform-lock"
  }
}

variable "environment" {
  default = "production"
}

variable "aws_region" {
  default = "ap-southeast-2"
}

variable "vpc_cidr" {
  default = "10.3.0.0/16"
}

variable "public_subnet_cidrs" {
  default = ["10.3.1.0/24", "10.3.2.0/24", "10.3.3.0/24"]
}

variable "private_subnet_cidrs" {
  default = ["10.3.10.0/24", "10.3.11.0/24", "10.3.12.0/24"]
}

variable "db_subnet_cidrs" {
  default = ["10.3.20.0/24", "10.3.21.0/24", "10.3.22.0/24"]
}

variable "ecs_task_cpu" {
  default = 1
}

variable "ecs_task_memory" {
  default = 2048
}

variable "ecs_min_tasks" {
  default = 2
}

variable "ecs_max_tasks" {
  default = 6
}

variable "rds_instance_class" {
  default = "db.t3.large"
}

variable "rds_allocated_storage" {
  default = 100
}

variable "rds_multi_az" {
  default = true
}

variable "redis_node_type" {
  default = "cache.t3.medium"
}

variable "redis_num_cache_nodes" {
  default = 2
}

variable "redis_multi_az" {
  default = true
}

enable_multi_az = true
